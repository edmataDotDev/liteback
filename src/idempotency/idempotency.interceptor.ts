import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { generateHmac } from '../libs/generateHmac';
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_STATUS,
  IDEMPOTENT_ROUTE_KEY,
} from './idempotency.constants';

type RequestWithUser = Request & { user?: { sub?: string } };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.get<boolean>(
      IDEMPOTENT_ROUTE_KEY,
      context.getHandler(),
    );
    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();
    const keyRaw = request.headers[IDEMPOTENCY_HEADER];
    const idempotencyKey = Array.isArray(keyRaw) ? keyRaw[0] : keyRaw;
    if (!idempotencyKey || !this.isUuid(idempotencyKey)) {
      throw new BadRequestException(
        'Missing or invalid Idempotency-Key header',
      );
    }

    const requestHash = this.computeRequestHash(request);

    return from(
      this.prisma.idempotencyKey.create({
        data: {
          idempotencyKey,
          requestHash,
          status: IDEMPOTENCY_STATUS.PROCESSING,
        },
      }),
    ).pipe(
      mergeMap(() =>
        next.handle().pipe(
          mergeMap((body) =>
            from(
              this.prisma.idempotencyKey.update({
                where: { idempotencyKey },
                data: {
                  status: IDEMPOTENCY_STATUS.COMPLETED,
                  responseCode: response.statusCode,
                  responseBody: this.toJson(body),
                },
              }),
            ).pipe(
              mergeMap(() => {
                this.logIdempotencyLocally(
                  idempotencyKey,
                  request,
                  'first_run_completed',
                  { httpStatus: response.statusCode },
                );
                return of(body);
              }),
            ),
          ),
          catchError((error: unknown) =>
            from(this.persistFailure(idempotencyKey, error)).pipe(
              mergeMap(() => {
                const httpStatus =
                  error instanceof HttpException ? error.getStatus() : 500;
                this.logIdempotencyLocally(
                  idempotencyKey,
                  request,
                  'first_run_failed_stored',
                  { httpStatus },
                );
                return throwError(() => error);
              }),
            ),
          ),
        ),
      ),
      catchError((error: unknown) => {
        if (!this.isUniqueViolation(error)) {
          this.logIdempotencyLocally(
            idempotencyKey,
            request,
            'idempotency_row_create_or_upstream_error',
            {
              error:
                error instanceof Error
                  ? error.message
                  : String(error).slice(0, 120),
            },
          );
          return throwError(() => error);
        }

        return from(
          this.prisma.idempotencyKey.findUnique({
            where: { idempotencyKey },
          }),
        ).pipe(
          mergeMap((existing) => {
            if (!existing) {
              this.logIdempotencyLocally(
                idempotencyKey,
                request,
                'replay_conflict',
                { reason: 'race_no_row' },
              );
              return throwError(
                () => new ConflictException('Idempotency key race condition'),
              );
            }

            if (existing.requestHash !== requestHash) {
              this.logIdempotencyLocally(
                idempotencyKey,
                request,
                'replay_conflict',
                { reason: 'same_key_different_request' },
              );
              return throwError(
                () =>
                  new ConflictException(
                    'Idempotency-Key already used for a different request',
                  ),
              );
            }

            if (existing.status === IDEMPOTENCY_STATUS.PROCESSING) {
              this.logIdempotencyLocally(
                idempotencyKey,
                request,
                'replay_conflict',
                { reason: 'still_processing' },
              );
              return throwError(
                () =>
                  new ConflictException(
                    'Request with this Idempotency-Key is still processing',
                  ),
              );
            }

            const replayCode =
              existing.responseCode ??
              (existing.status === IDEMPOTENCY_STATUS.COMPLETED ? 200 : 500);
            response.status(replayCode);
            const replayBody = this.fromJson(existing.responseBody);

            if (existing.status === IDEMPOTENCY_STATUS.FAILED) {
              this.logIdempotencyLocally(
                idempotencyKey,
                request,
                'replay_prior_failure',
                {
                  httpStatus: replayCode,
                  storedStatus: existing.status,
                },
              );
              const errorBody = replayBody ?? {
                message: 'Idempotent request previously failed',
              };
              return throwError(() => new HttpException(errorBody, replayCode));
            }

            this.logIdempotencyLocally(
              idempotencyKey,
              request,
              'replay_cached_success',
              {
                httpStatus: replayCode,
                storedStatus: existing.status,
              },
            );
            return of(replayBody);
          }),
        );
      }),
    );
  }

  private logIdempotencyLocally(
    idempotencyKey: string,
    request: RequestWithUser,
    outcome: string,
    extra?: Record<string, string | number | undefined>,
  ): void {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    const parts = [
      `Idempotency-Key=${idempotencyKey}`,
      `${request.method} ${request.path}`,
      `outcome=${outcome}`,
    ];
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined) {
          parts.push(`${k}=${v}`);
        }
      }
    }
    this.logger.log(parts.join(' | '));
  }

  private computeRequestHash(request: RequestWithUser): string {
    const requestBody = request.body as unknown;
    const canonicalPayload = this.stableStringify({
      method: request.method,
      path: request.path,
      query: request.query ?? {},
      body: requestBody ?? null,
      sub: request.user?.sub ?? null,
    });
    return generateHmac(canonicalPayload);
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`)
      .join(',')}}`;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async persistFailure(
    idempotencyKey: string,
    error: unknown,
  ): Promise<void> {
    const responseCode =
      error instanceof HttpException ? error.getStatus() : 500;
    const responseBody =
      error instanceof HttpException
        ? error.getResponse()
        : { message: 'Internal Server Error' };

    await this.prisma.idempotencyKey.update({
      where: { idempotencyKey },
      data: {
        status: IDEMPOTENCY_STATUS.FAILED,
        responseCode,
        responseBody: this.toJson(responseBody),
      },
    });
  }

  private toJson(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === undefined) {
      return Prisma.JsonNull;
    }
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private fromJson(value: Prisma.JsonValue | null): unknown {
    if (value === null) {
      return null;
    }
    return value;
  }
}

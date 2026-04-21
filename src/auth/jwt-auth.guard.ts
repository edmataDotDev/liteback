import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JWT_AUDIENCE, JWT_ISSUER } from './jwt-claims';
import { AccessTokenPayload } from './jwt-payload.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = this.extractBearer(header);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          algorithms: ['RS256'],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
      );

      if (
        typeof payload.sessionId !== 'number' ||
        Number.isNaN(payload.sessionId)
      ) {
        throw new UnauthorizedException('Invalid token');
      }

      const now = new Date();
      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sessionId,
          user: { publicId: payload.sub },
        },
        select: { revokedAt: true, expiresAt: true },
      });
      if (!session) {
        throw new UnauthorizedException('Session not found');
      }
      if (session.revokedAt != null) {
        throw new UnauthorizedException('Session revoked');
      }
      if (session.expiresAt <= now) {
        throw new UnauthorizedException('Session expired');
      }

      (request as Request & { user?: AccessTokenPayload }).user = payload;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearer(header: string | undefined): string | null {
    if (!header || !header.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }
}

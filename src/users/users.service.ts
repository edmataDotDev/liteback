import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, LoginUserDto, RefreshTokenDto } from './users.dto';
import { AuthTokens } from './users.types';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { generateHmac } from '../libs/generateHmac';
import { JWT_AUDIENCE, JWT_ISSUER } from '../auth/jwt-claims';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async refresh({ refreshToken }: RefreshTokenDto): Promise<AuthTokens> {
    const tokenHash = generateHmac(refreshToken);
    const probe = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      select: { id: true },
    });
    if (!probe) {
      throw new NotFoundException('No valid refresh token');
    }

    type RefreshOutcome =
      | { kind: 'ok'; tokens: AuthTokens }
      | { kind: 'not_found' }
      | { kind: 'unauthorized'; message: string };

    const outcome = await this.prisma.$transaction(
      async (tx): Promise<RefreshOutcome> => {
        const row = await tx.refreshToken.findUnique({
          where: { id: probe.id },
          include: {
            session: {
              include: {
                user: { select: { publicId: true } },
              },
            },
          },
        });
        if (!row) {
          return { kind: 'not_found' };
        }

        const now = new Date();
        const session = row.session;

        if (session.revokedAt != null || session.expiresAt <= now) {
          return {
            kind: 'unauthorized',
            message: 'Session invalid or expired',
          };
        }

        if (row.rotatedAt != null) {
          await tx.session.update({
            where: { id: session.id },
            data: { revokedAt: now },
          });
          return {
            kind: 'unauthorized',
            message: 'Refresh token reuse detected',
          };
        }

        if (row.expiresAt <= now) {
          await tx.session.update({
            where: { id: session.id },
            data: { revokedAt: now },
          });
          return { kind: 'unauthorized', message: 'Refresh token expired' };
        }

        const claimed = await tx.refreshToken.updateMany({
          where: {
            id: row.id,
            rotatedAt: null,
            tokenHash,
            expiresAt: { gt: now },
          },
          data: { rotatedAt: now },
        });

        if (claimed.count !== 1) {
          const afterRace = await tx.refreshToken.findUnique({
            where: { id: row.id },
            select: { rotatedAt: true },
          });
          if (afterRace?.rotatedAt != null) {
            return {
              kind: 'unauthorized',
              message: 'Refresh already in progress',
            };
          }
          return { kind: 'unauthorized', message: 'Refresh token invalid' };
        }

        const newRefreshRaw = randomBytes(32).toString('hex');
        const newTokenHash = generateHmac(newRefreshRaw);

        await tx.refreshToken.create({
          data: {
            sessionId: row.sessionId,
            tokenHash: newTokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            rotatedFromTokenId: row.id,
          },
        });

        const nowSec = Math.floor(now.getTime() / 1000);
        const accessToken = this.jwtService.sign({
          iss: JWT_ISSUER,
          aud: JWT_AUDIENCE,
          sub: session.user.publicId,
          nbf: nowSec,
          iat: nowSec,
        });

        return {
          kind: 'ok',
          tokens: { accessToken, refreshToken: newRefreshRaw },
        };
      },
    );

    if (outcome.kind === 'not_found') {
      throw new NotFoundException('No valid refresh token');
    }
    if (outcome.kind === 'unauthorized') {
      throw new UnauthorizedException(outcome.message);
    }
    return outcome.tokens;
  }

  async login({ email, password }: LoginUserDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      select: { id: true, publicId: true, email: true, passwordHash: true },
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('No valid credentials');
    }
    const isSamePass = await bcrypt.compare(password, user?.passwordHash);

    if (!isSamePass) {
      throw new UnauthorizedException('No valid credentials');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const accessToken = this.jwtService.sign({
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      sub: user?.publicId,
      nbf: nowSec,
      iat: nowSec,
    });

    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        tokens: {
          create: {
            tokenHash: generateHmac(refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        },
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        customers: {
          create: {
            email: dto.email,
            firstName: dto.firstName,
            lastName: dto.lastName,
          },
        },
      },
      select: {
        id: true,
        publicId: true,
        email: true,
        createdAt: true,
        customers: true,
      },
    });
  }
}

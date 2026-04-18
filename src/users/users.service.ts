import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, LoginUserDto } from './users.dto';
import { AuthTokens } from './users.types';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) { }

  async login({ email, password }: LoginUserDto): Promise<AuthTokens> {

    const user = await this.prisma.user.findUnique({
      select: { id: true, publicId: true, email: true, passwordHash: true },
      where: {
        email
      }
    });

    if (!user) {
      throw new UnauthorizedException('No valid credentials');
    }
    const isSamePass = await bcrypt.compare(password, user?.passwordHash)

    if (!isSamePass) {
      throw new UnauthorizedException('No valid credentials');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const accessToken = this.jwtService.sign({
      iss: "http://localhost:3000",
      aud: "general",
      sub: user?.publicId,
      nbf: nowSec,
      iat: nowSec,
      exp: nowSec + 15 * 60,
    });


    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        tokens: {
          create: {
            tokenHash: await bcrypt.hash(refreshToken, 10),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          }
        }
      }
    })

    return {
      accessToken,
      refreshToken
    }
  }

  async register(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
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
      include: { customers: true },
    });

    const { passwordHash: _removed, ...safe } = user;
    return safe;
  }
}

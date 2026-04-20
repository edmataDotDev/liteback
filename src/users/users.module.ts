import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SIGN_OPTIONS, jwtConstants } from './constants';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [
    PrismaModule,
    IdempotencyModule,
    JwtModule.register({
      global: true,
      privateKey: jwtConstants.privateKey,
      publicKey: jwtConstants.publicKey,
      signOptions: JWT_SIGN_OPTIONS,
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

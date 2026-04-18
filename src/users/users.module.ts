import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';

@Module({
  imports: [PrismaModule, JwtModule.register({
    global: true,
    secret: jwtConstants.privateKey,
    signOptions: { expiresIn: '15m' },
  })],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule { }

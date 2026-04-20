import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, LoginUserDto, RefreshTokenDto } from './users.dto';
import { AuthTokens } from './users.types';
import { Idempotent } from '../idempotency/idempotency.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  @UsePipes(new ValidationPipe())
  login(@Body() user: LoginUserDto): Promise<AuthTokens> {
    return this.usersService.login(user);
  }

  @Post('register')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @UsePipes(new ValidationPipe({ transform: true }))
  register(@Body() newUser: CreateUserDto) {
    return this.usersService.register(newUser);
  }

  @Post('refresh')
  @UsePipes(new ValidationPipe({ transform: true }))
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.usersService.refresh(refreshTokenDto);
  }
}

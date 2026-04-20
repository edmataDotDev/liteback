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
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Login with credentials' })
  @ApiBody({ type: LoginUserDto })
  @ApiOkResponse({
    description: 'Returns access and refresh tokens',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  login(@Body() user: LoginUserDto): Promise<AuthTokens> {
    return this.usersService.login(user);
  }

  @Post('register')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Register user and create customer profile' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID key used to guarantee idempotent execution',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiOkResponse({ description: 'Returns created user payload' })
  register(@Body() newUser: CreateUserDto) {
    return this.usersService.register(newUser);
  }

  @Post('refresh')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'Returns rotated access and refresh tokens',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.usersService.refresh(refreshTokenDto);
  }
}

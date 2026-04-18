import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, LoginUserDto } from './users.dto';
import { AuthTokens } from './users.types';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('login')
    @UsePipes(new ValidationPipe())
    login(@Body() user: LoginUserDto): Promise<AuthTokens> {
        return this.usersService.login(user);
    }

    @Post('register')
    @UsePipes(new ValidationPipe({ transform: true }))
    register(@Body() newUser: CreateUserDto) {
        return this.usersService.register(newUser);
    }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './customers.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  getMe(@CurrentUser('sub') userPublicId: string) {
    return this.customersService.getMe(userPublicId);
  }

  @Patch('me')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  updateMe(
    @CurrentUser('sub') userPublicId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateMe(userPublicId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMe(@CurrentUser('sub') userPublicId: string) {
    return this.customersService.removeMe(userPublicId);
  }
}

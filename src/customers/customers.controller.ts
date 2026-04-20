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
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiTags('customers')
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated customer profile' })
  @ApiOkResponse({ description: 'Customer profile payload' })
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
  @ApiOperation({ summary: 'Update current customer profile' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiOkResponse({ description: 'Updated customer profile payload' })
  updateMe(
    @CurrentUser('sub') userPublicId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateMe(userPublicId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current customer profile' })
  @ApiNoContentResponse({ description: 'Customer profile deleted' })
  removeMe(@CurrentUser('sub') userPublicId: string) {
    return this.customersService.removeMe(userPublicId);
  }
}

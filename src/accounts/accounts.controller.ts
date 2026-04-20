import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AccountsService } from './accounts.service';
import { Idempotent } from '../idempotency/idempotency.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  listMine(@CurrentUser('sub') userPublicId: string) {
    return this.accountsService.listMine(userPublicId);
  }

  @Get(':id')
  getMineById(
    @CurrentUser('sub') userPublicId: string,
    @Param('id', ParseIntPipe) accountId: number,
  ) {
    return this.accountsService.getMineById(userPublicId, accountId);
  }

  @Delete(':id')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMineById(
    @CurrentUser('sub') userPublicId: string,
    @Param('id', ParseIntPipe) accountId: number,
  ) {
    return this.accountsService.removeMineById(userPublicId, accountId);
  }
}

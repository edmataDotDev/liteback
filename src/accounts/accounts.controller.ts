import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AccountsService } from './accounts.service';

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
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMineById(
    @CurrentUser('sub') userPublicId: string,
    @Param('id', ParseIntPipe) accountId: number,
  ) {
    return this.accountsService.removeMineById(userPublicId, accountId);
  }
}

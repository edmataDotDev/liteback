import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AccountsService } from './accounts.service';
import { Idempotent } from '../idempotency/idempotency.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import {
  CreateAccountDto,
  DepositDto,
  TransferDto,
  WithdrawDto,
} from './accounts.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiTags('accounts')
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List accounts owned by authenticated customer' })
  @ApiOkResponse({ description: 'Array of owned accounts' })
  listMine(@CurrentUser('sub') userPublicId: string) {
    return this.accountsService.listMine(userPublicId);
  }

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new account for authenticated customer (idempotent)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID key used to guarantee idempotent execution',
  })
  @ApiBody({ type: CreateAccountDto })
  @ApiOkResponse({ description: 'Created account payload (same shape as GET /accounts items)' })
  createMine(
    @CurrentUser('sub') userPublicId: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.createMine(userPublicId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one owned account by internal id' })
  @ApiOkResponse({ description: 'Owned account payload' })
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
  @ApiOperation({ summary: 'Delete one owned account (idempotent)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID key used to guarantee idempotent execution',
  })
  @ApiNoContentResponse({ description: 'Account removed (idempotent no-content)' })
  removeMineById(
    @CurrentUser('sub') userPublicId: string,
    @Param('id', ParseIntPipe) accountId: number,
  ) {
    return this.accountsService.removeMineById(userPublicId, accountId);
  }

  @Post('deposit')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deposit funds into owned account (idempotent)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID key used to guarantee idempotent execution',
  })
  @ApiBody({ type: DepositDto })
  @ApiOkResponse({ description: 'Deposit transaction result' })
  deposit(
    @CurrentUser('sub') userPublicId: string,
    @Body() dto: DepositDto,
  ) {
    return this.accountsService.deposit(userPublicId, dto);
  }

  @Post('withdraw')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw funds from owned account (idempotent)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID key used to guarantee idempotent execution',
  })
  @ApiBody({ type: WithdrawDto })
  @ApiOkResponse({ description: 'Withdrawal transaction result' })
  withdraw(
    @CurrentUser('sub') userPublicId: string,
    @Body() dto: WithdrawDto,
  ) {
    return this.accountsService.withdraw(userPublicId, dto);
  }

  @Post('transfer')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer between accounts (idempotent)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID key used to guarantee idempotent execution',
  })
  @ApiBody({ type: TransferDto })
  @ApiOkResponse({ description: 'Transfer operation result' })
  transfer(
    @CurrentUser('sub') userPublicId: string,
    @Body() dto: TransferDto,
  ) {
    return this.accountsService.transfer(userPublicId, dto);
  }
}

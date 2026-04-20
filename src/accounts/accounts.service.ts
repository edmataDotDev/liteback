import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TransactionType } from '@prisma/client';
import {
  CreateAccountDto,
  DepositDto,
  TransferDto,
  WithdrawDto,
} from './accounts.dto';

const accountSelect = {
  id: true,
  publicId: true,
  balanceMinor: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCustomerIdByUserPublicId(
    userPublicId: string,
  ): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer.id;
  }

  private async getOwnedAccountByPublicId(
    customerId: number,
    publicId: string,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { publicId, customerId },
      select: { id: true, publicId: true, customerId: true, currency: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  private mapFinancialDbError(error: unknown): never {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
        ? error.message
        : String(error);
    if (message.includes('Insufficient funds')) {
      throw new ConflictException('Insufficient funds');
    }
    throw error;
  }

  async listMine(userPublicId: string) {
    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    return this.prisma.account.findMany({
      where: { customerId },
      select: accountSelect,
      orderBy: { id: 'asc' },
    });
  }

  async getMineById(userPublicId: string, accountId: number) {
    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, customerId },
      select: accountSelect,
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async createMine(userPublicId: string, dto: CreateAccountDto) {
    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    return this.prisma.account.create({
      data: {
        customerId,
        currency: dto.currency,
        balanceMinor: 0,
      },
      select: accountSelect,
    });
  }

  async removeMineById(userPublicId: string, accountId: number): Promise<void> {
    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    await this.prisma.account.deleteMany({
      where: { id: accountId, customerId },
    });
  }

  async deposit(userPublicId: string, dto: DepositDto) {
    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    const account = await this.getOwnedAccountByPublicId(
      customerId,
      dto.accountPublicId,
    );

    const tx = await this.prisma.transaction.create({
      data: {
        customerId,
        accountId: account.id,
        type: TransactionType.DEPOSIT,
        amountMinor: dto.amountMinor,
      },
      select: { id: true, type: true, amountMinor: true, createdAt: true },
    });

    return {
      accountPublicId: account.publicId,
      transaction: tx,
    };
  }

  async withdraw(userPublicId: string, dto: WithdrawDto) {
    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    const account = await this.getOwnedAccountByPublicId(
      customerId,
      dto.accountPublicId,
    );

    try {
      const tx = await this.prisma.transaction.create({
        data: {
          customerId,
          accountId: account.id,
          type: TransactionType.WITHDRAWAL,
          amountMinor: dto.amountMinor,
        },
        select: { id: true, type: true, amountMinor: true, createdAt: true },
      });

      return {
        accountPublicId: account.publicId,
        transaction: tx,
      };
    } catch (error) {
      this.mapFinancialDbError(error);
    }
  }

  async transfer(userPublicId: string, dto: TransferDto) {
    if (dto.fromAccountPublicId === dto.toAccountPublicId) {
      throw new BadRequestException('Origin and destination accounts must differ');
    }

    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    const from = await this.getOwnedAccountByPublicId(
      customerId,
      dto.fromAccountPublicId,
    );
    const to = await this.prisma.account.findUnique({
      where: { publicId: dto.toAccountPublicId },
      select: { id: true, publicId: true, customerId: true, currency: true },
    });
    if (!to) {
      throw new NotFoundException('Destination account not found');
    }
    if (from.currency !== to.currency) {
      throw new ConflictException('Currency mismatch is not supported');
    }

    try {
      const [withdrawal, deposit] = await this.prisma.$transaction([
        this.prisma.transaction.create({
          data: {
            customerId,
            accountId: from.id,
            type: TransactionType.WITHDRAWAL,
            amountMinor: dto.amountMinor,
          },
          select: { id: true, type: true, amountMinor: true, createdAt: true },
        }),
        this.prisma.transaction.create({
          data: {
            customerId: to.customerId,
            accountId: to.id,
            type: TransactionType.DEPOSIT,
            amountMinor: dto.amountMinor,
          },
          select: { id: true, type: true, amountMinor: true, createdAt: true },
        }),
      ]);

      return {
        fromAccountPublicId: from.publicId,
        toAccountPublicId: to.publicId,
        currency: from.currency,
        withdrawal,
        deposit,
      };
    } catch (error) {
      this.mapFinancialDbError(error);
    }
  }
}

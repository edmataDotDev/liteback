import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const accountSelect = {
  id: true,
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

  async removeMineById(userPublicId: string, accountId: number): Promise<void> {
    const customerId = await this.getCustomerIdByUserPublicId(userPublicId);
    await this.prisma.account.deleteMany({
      where: { id: accountId, customerId },
    });
  }
}

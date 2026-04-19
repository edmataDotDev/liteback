import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerDto } from './customers.dto';

const customerSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userPublicId: string) {
    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: customerSelect,
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async updateMe(userPublicId: string, dto: UpdateCustomerDto) {
    const hasField =
      dto.email !== undefined ||
      dto.firstName !== undefined ||
      dto.lastName !== undefined;
    if (!hasField) {
      throw new BadRequestException('At least one field is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { publicId: userPublicId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customer.update({
      where: { userId: user.id },
      data: {
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      },
      select: customerSelect,
    });
  }

  async removeMe(userPublicId: string): Promise<void> {
    await this.prisma.customer.deleteMany({
      where: { user: { publicId: userPublicId } },
    });
  }
}

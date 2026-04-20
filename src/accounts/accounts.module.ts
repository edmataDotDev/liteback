import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [PrismaModule, IdempotencyModule],
  controllers: [AccountsController],
  providers: [AccountsService, JwtAuthGuard],
})
export class AccountsModule {}

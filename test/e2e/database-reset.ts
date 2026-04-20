import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Vacía todas las tablas de dominio. Usar solo contra una BD de test dedicada
 * (mismo `DATABASE_URL` que Prisma; ver docs/PROJECT.md).
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      refresh_tokens,
      sessions,
      transactions,
      accounts,
      customers,
      idempotency_keys,
      users
    RESTART IDENTITY CASCADE;
  `);
}

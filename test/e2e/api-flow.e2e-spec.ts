import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from './create-app';
import { resetDatabase } from './database-reset';
import {
  authHeader,
  login,
  registerUser,
  validIdempotencyKey,
} from './http-helpers';

describe('API flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns hello', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it(
    'runs full register → auth → customer → accounts → movements → transfer → delete',
    async () => {
    const { credentials: u1c, res: u1reg } = await registerUser(app);
    const u1login = await login(app, u1c.email, u1c.password);
    expect(u1reg.publicId).toBeTruthy();
    expect(u1reg.customers).toHaveLength(1);

    const refreshed = await request(app.getHttpServer())
      .post('/users/refresh')
      .send({ refreshToken: u1login.refreshToken })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBeTruthy();
    expect(refreshed.body.refreshToken).not.toBe(u1login.refreshToken);

    const access1 = refreshed.body.accessToken as string;

    const me1 = await request(app.getHttpServer())
      .get('/customers/me')
      .set(authHeader(access1))
      .expect(200);
    expect(me1.body.email).toBe(u1c.email);

    await request(app.getHttpServer())
      .patch('/customers/me')
      .set(authHeader(access1))
      .send({ firstName: 'Updated' })
      .expect(200);

    const acc1Res = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(access1))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    expect(acc1Res.body.balanceMinor).toBe(0);
    const acc1Id = acc1Res.body.id as number;
    const acc1PublicId = acc1Res.body.publicId as string;

    const list1 = await request(app.getHttpServer())
      .get('/accounts')
      .set(authHeader(access1))
      .expect(200);
    expect(Array.isArray(list1.body)).toBe(true);
    expect(list1.body.some((a: { id: number }) => a.id === acc1Id)).toBe(true);

    const getById = await request(app.getHttpServer())
      .get(`/accounts/${acc1Id}`)
      .set(authHeader(access1))
      .expect(200);
    expect(getById.body.publicId).toBe(acc1PublicId);

    const depositAmount = 10_000;
    const dep = await request(app.getHttpServer())
      .post('/accounts/deposit')
      .set(authHeader(access1))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ accountPublicId: acc1PublicId, amountMinor: depositAmount })
      .expect(200);
    expect(dep.body.transaction.type).toBe('DEPOSIT');

    const afterDeposit = await request(app.getHttpServer())
      .get(`/accounts/${acc1Id}`)
      .set(authHeader(access1))
      .expect(200);
    expect(afterDeposit.body.balanceMinor).toBe(depositAmount);

    const withdrawAmount = 1_000;
    await request(app.getHttpServer())
      .post('/accounts/withdraw')
      .set(authHeader(access1))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ accountPublicId: acc1PublicId, amountMinor: withdrawAmount })
      .expect(200);

    const afterWithdraw = await request(app.getHttpServer())
      .get(`/accounts/${acc1Id}`)
      .set(authHeader(access1))
      .expect(200);
    expect(afterWithdraw.body.balanceMinor).toBe(depositAmount - withdrawAmount);

    const { credentials: u2c } = await registerUser(app);
    const u2login = await login(app, u2c.email, u2c.password);
    const acc2Res = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(u2login.accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    const acc2PublicId = acc2Res.body.publicId as string;
    const acc2Id = acc2Res.body.id as number;

    const transferAmount = 500;
    await request(app.getHttpServer())
      .post('/accounts/transfer')
      .set(authHeader(access1))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({
        fromAccountPublicId: acc1PublicId,
        toAccountPublicId: acc2PublicId,
        amountMinor: transferAmount,
      })
      .expect(200);

    const u1Final = await request(app.getHttpServer())
      .get(`/accounts/${acc1Id}`)
      .set(authHeader(access1))
      .expect(200);
    expect(u1Final.body.balanceMinor).toBe(
      depositAmount - withdrawAmount - transferAmount,
    );

    const u2Final = await request(app.getHttpServer())
      .get(`/accounts/${acc2Id}`)
      .set(authHeader(u2login.accessToken))
      .expect(200);
    expect(u2Final.body.balanceMinor).toBe(transferAmount);

    await request(app.getHttpServer())
      .delete(`/accounts/${acc1Id}`)
      .set(authHeader(access1))
      .set('Idempotency-Key', validIdempotencyKey())
      .expect(204);

    await request(app.getHttpServer())
      .delete('/customers/me')
      .set(authHeader(access1))
      .expect(204);
    },
    30_000,
  );
});

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

describe('Idempotency stress (e2e)', () => {
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

  it('sequential replay: same key and body returns same transaction id and does not double balance', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    const acc = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    const publicId = acc.body.publicId as string;
    const accId = acc.body.id as number;

    const key = validIdempotencyKey();
    const body = { accountPublicId: publicId, amountMinor: 777 };

    const first = await request(app.getHttpServer())
      .post('/accounts/deposit')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', key)
      .send(body)
      .expect(200);
    const second = await request(app.getHttpServer())
      .post('/accounts/deposit')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', key)
      .send(body)
      .expect(200);

    expect(second.body).toEqual(first.body);

    const final = await request(app.getHttpServer())
      .get(`/accounts/${accId}`)
      .set(authHeader(accessToken))
      .expect(200);
    expect(final.body.balanceMinor).toBe(777);
  });

  it('two deposits with different keys both apply', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    const acc = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    const publicId = acc.body.publicId as string;
    const accId = acc.body.id as number;

    await request(app.getHttpServer())
      .post('/accounts/deposit')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ accountPublicId: publicId, amountMinor: 100 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/accounts/deposit')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ accountPublicId: publicId, amountMinor: 50 })
      .expect(200);

    const final = await request(app.getHttpServer())
      .get(`/accounts/${accId}`)
      .set(authHeader(accessToken))
      .expect(200);
    expect(final.body.balanceMinor).toBe(150);
  });

  it('parallel identical deposit requests: balance increases exactly once', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    const acc = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    const publicId = acc.body.publicId as string;
    const accId = acc.body.id as number;

    const key = validIdempotencyKey();
    const body = { accountPublicId: publicId, amountMinor: 333 };
    const n = 8;
    const results = await Promise.all(
      Array.from({ length: n }, () =>
        request(app.getHttpServer())
          .post('/accounts/deposit')
          .set(authHeader(accessToken))
          .set('Idempotency-Key', key)
          .send(body),
      ),
    );

    const ok = results.filter((r) => r.status === 200);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const txIds = ok
      .map((r) => r.body.transaction?.id as number | undefined)
      .filter((id): id is number => id !== undefined);
    expect(new Set(txIds).size).toBe(1);

    let balance = 0;
    for (let i = 0; i < 30; i += 1) {
      const snap = await request(app.getHttpServer())
        .get(`/accounts/${accId}`)
        .set(authHeader(accessToken));
      balance = snap.body.balanceMinor as number;
      if (balance === 333) {
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(balance).toBe(333);
  });

  it('failed idempotent withdraw then replay returns same error', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    const acc = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    const publicId = acc.body.publicId as string;

    const key = validIdempotencyKey();
    const body = { accountPublicId: publicId, amountMinor: 50_000 };

    const first = await request(app.getHttpServer())
      .post('/accounts/withdraw')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(409);

    const second = await request(app.getHttpServer())
      .post('/accounts/withdraw')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', key)
      .send(body);
    expect(second.status).toBe(409);
    expect(second.body).toEqual(first.body);
  });

  it('burst: many unique keys each deposit once', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    const acc = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    const publicId = acc.body.publicId as string;
    const accId = acc.body.id as number;

    const count = 25;
    const amountEach = 10;
    await Promise.all(
      Array.from({ length: count }, () =>
        request(app.getHttpServer())
          .post('/accounts/deposit')
          .set(authHeader(accessToken))
          .set('Idempotency-Key', validIdempotencyKey())
          .send({ accountPublicId: publicId, amountMinor: amountEach })
          .expect(200),
      ),
    );

    const final = await request(app.getHttpServer())
      .get(`/accounts/${accId}`)
      .set(authHeader(accessToken))
      .expect(200);
    expect(final.body.balanceMinor).toBe(count * amountEach);
  });
});

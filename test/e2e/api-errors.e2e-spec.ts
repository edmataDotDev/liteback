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

describe('API errors (e2e)', () => {
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

  it('GET /accounts without Authorization → 401', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
  });

  it('GET /accounts with invalid Bearer → 401', async () => {
    await request(app.getHttpServer())
      .get('/accounts')
      .set({ Authorization: 'Bearer invalid.token.here' })
      .expect(401);
  });

  it('POST /accounts without Idempotency-Key → 400', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .send({ currency: 'USD' })
      .expect(400);
  });

  it('POST /accounts with invalid Idempotency-Key → 400', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', 'not-a-valid-uuid')
      .send({ currency: 'USD' })
      .expect(400);
  });

  it('same Idempotency-Key with different body on register → 409', async () => {
    const key = validIdempotencyKey();
    const suffix = validIdempotencyKey().slice(0, 8);
    await request(app.getHttpServer())
      .post('/users/register')
      .set('Idempotency-Key', key)
      .send({
        email: `a_${suffix}@test.example`,
        password: 'E2eTest#Pass1',
        firstName: 'A',
        lastName: 'One',
      })
      .expect((r) => expect([200, 201]).toContain(r.status));

    await request(app.getHttpServer())
      .post('/users/register')
      .set('Idempotency-Key', key)
      .send({
        email: `b_${suffix}@test.example`,
        password: 'E2eTest#Pass1',
        firstName: 'B',
        lastName: 'Two',
      })
      .expect(409);
  });

  it('POST /users/login wrong password → 401', async () => {
    const { credentials } = await registerUser(app);
    await request(app.getHttpServer())
      .post('/users/login')
      .send({ email: credentials.email, password: 'WrongPassword!!!' })
      .expect(401);
  });

  it('POST /users/refresh with garbage token → 404 or 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/refresh')
      .send({ refreshToken: '0'.repeat(64) })
      .expect((r) => {
        expect([401, 404]).toContain(r.status);
      });
    expect(res.status).toBeDefined();
  });

  it('PATCH /customers/me with empty body → 400', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    await request(app.getHttpServer())
      .patch('/customers/me')
      .set(authHeader(accessToken))
      .send({})
      .expect(400);
  });

  it('POST /accounts/withdraw over balance → 409', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    const acc = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/accounts/deposit')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ accountPublicId: acc.body.publicId, amountMinor: 100 })
      .expect(200);

    await request(app.getHttpServer())
      .post('/accounts/withdraw')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ accountPublicId: acc.body.publicId, amountMinor: 999_999 })
      .expect(409);
  });

  it('POST /accounts/transfer same origin and destination → 400', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    const acc = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/accounts/transfer')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({
        fromAccountPublicId: acc.body.publicId,
        toAccountPublicId: acc.body.publicId,
        amountMinor: 1,
      })
      .expect(400);
  });

  it('POST /accounts/transfer currency mismatch → 409', async () => {
    const { credentials: c1 } = await registerUser(app);
    const t1 = await login(app, c1.email, c1.password);
    const accUsd = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(t1.accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'USD' })
      .expect(200);

    const { credentials: c2 } = await registerUser(app);
    const t2 = await login(app, c2.email, c2.password);
    const accEur = await request(app.getHttpServer())
      .post('/accounts')
      .set(authHeader(t2.accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ currency: 'EUR' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/accounts/transfer')
      .set(authHeader(t1.accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({
        fromAccountPublicId: accUsd.body.publicId,
        toAccountPublicId: accEur.body.publicId,
        amountMinor: 1,
      })
      .expect(409);
  });

  it('POST /accounts/deposit unknown accountPublicId → 404', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    await request(app.getHttpServer())
      .post('/accounts/deposit')
      .set(authHeader(accessToken))
      .set('Idempotency-Key', validIdempotencyKey())
      .send({ accountPublicId: 'deadbeefcafe', amountMinor: 100 })
      .expect(404);
  });

  it('GET /accounts/:id unknown id → 404', async () => {
    const { credentials } = await registerUser(app);
    const { accessToken } = await login(app, credentials.email, credentials.password);
    await request(app.getHttpServer())
      .get('/accounts/999999')
      .set(authHeader(accessToken))
      .expect(404);
  });
});

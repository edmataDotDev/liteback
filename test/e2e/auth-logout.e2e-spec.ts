import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp } from './create-app';
import { resetDatabase } from './database-reset';
import { authHeader, login, registerUser } from './http-helpers';

describe('Auth logout (e2e)', () => {
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

  it('POST /users/logout without Bearer → 401', async () => {
    await request(app.getHttpServer()).post('/users/logout').expect(401);
  });

  it('after logout, access token and refresh token from that session are rejected', async () => {
    const { credentials } = await registerUser(app);
    const tokens = await login(app, credentials.email, credentials.password);

    await request(app.getHttpServer())
      .post('/users/logout')
      .set(authHeader(tokens.accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .get('/customers/me')
      .set(authHeader(tokens.accessToken))
      .expect(401);

    await request(app.getHttpServer())
      .post('/users/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect((r) => {
        expect([401, 404]).toContain(r.status);
      });
  });

  it('POST /users/logout twice with same token → second returns 401 (session already revoked)', async () => {
    const { credentials } = await registerUser(app);
    const tokens = await login(app, credentials.email, credentials.password);

    await request(app.getHttpServer())
      .post('/users/logout')
      .set(authHeader(tokens.accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .post('/users/logout')
      .set(authHeader(tokens.accessToken))
      .expect(401);
  });

  it('refresh then logout invalidates new access and new refresh', async () => {
    const { credentials } = await registerUser(app);
    const first = await login(app, credentials.email, credentials.password);
    const second = await request(app.getHttpServer())
      .post('/users/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect((r) => {
        expect([200, 201]).toContain(r.status);
      });

    await request(app.getHttpServer())
      .post('/users/logout')
      .set(authHeader(second.body.accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .get('/accounts')
      .set(authHeader(second.body.accessToken))
      .expect(401);

    await request(app.getHttpServer())
      .post('/users/refresh')
      .send({ refreshToken: second.body.refreshToken })
      .expect((r) => {
        expect([401, 404]).toContain(r.status);
      });
  });

  it('new login after logout gets a working session', async () => {
    const { credentials } = await registerUser(app);
    let tokens = await login(app, credentials.email, credentials.password);

    await request(app.getHttpServer())
      .post('/users/logout')
      .set(authHeader(tokens.accessToken))
      .expect(204);

    tokens = await login(app, credentials.email, credentials.password);
    await request(app.getHttpServer())
      .get('/customers/me')
      .set(authHeader(tokens.accessToken))
      .expect(200);
  });
});

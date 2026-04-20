import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** UUID v4 válido para el regex de `IdempotencyInterceptor`. */
export function validIdempotencyKey(): string {
  return randomUUID();
}

export function authHeader(accessToken: string): {
  Authorization: string;
} {
  return { Authorization: `Bearer ${accessToken}` };
}

export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type RegisterResponse = {
  id: number;
  publicId: string;
  email: string;
  createdAt: string;
  customers: Array<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    userId: number;
  }>;
};

export async function registerUser(
  app: INestApplication,
  overrides?: Partial<RegisterPayload>,
): Promise<{ res: RegisterResponse; credentials: RegisterPayload }> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  const credentials: RegisterPayload = {
    email: overrides?.email ?? `e2e_${suffix}@test.example`,
    password: overrides?.password ?? 'E2eTest#Pass1',
    firstName: overrides?.firstName ?? 'E2e',
    lastName: overrides?.lastName ?? 'User',
  };
  const res = await request(app.getHttpServer())
    .post('/users/register')
    .set('Idempotency-Key', validIdempotencyKey())
    .send(credentials)
    .expect((r) => {
      expect([200, 201]).toContain(r.status);
    });
  return { res: res.body as RegisterResponse, credentials };
}

export async function login(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app.getHttpServer())
    .post('/users/login')
    .send({ email, password })
    .expect((r) => {
      expect([200, 201]).toContain(r.status);
    });
  return res.body as { accessToken: string; refreshToken: string };
}

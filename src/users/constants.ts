import { loadPemFromEnv } from '../libs/loadPemFromEnv';

const privateKey = loadPemFromEnv(
  process.env.JWT_RS256_PRIVATE_KEY,
  'JWT_RS256_PRIVATE_KEY',
);
const publicKey = loadPemFromEnv(
  process.env.JWT_RS256_PUBLIC_KEY,
  'JWT_RS256_PUBLIC_KEY',
);

export const jwtConstants = {
  privateKey,
  publicKey,
} as const;

export const JWT_SIGN_OPTIONS = {
  algorithm: 'RS256' as const,
  expiresIn: '15m' as const,
};

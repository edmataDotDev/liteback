import { createPrivateKey, sign } from 'node:crypto';
import { loadPemFromEnv } from './loadPemFromEnv';

const privateKey = createPrivateKey(
  loadPemFromEnv(process.env.JWT_RS256_PRIVATE_KEY, 'JWT_RS256_PRIVATE_KEY'),
);

/** RSA-SHA256 fingerprint of `value` (hex), same key as access JWT (`JWT_RS256_PRIVATE_KEY`). */
export function generateHmac(value: string): string {
  return sign('RSA-SHA256', Buffer.from(value, 'utf8'), privateKey).toString('hex');
}

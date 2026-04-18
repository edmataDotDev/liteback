import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const privateKey = readFileSync(
    join(process.cwd(), 'jwt-rs256-private.pem'),
    'utf8',
);
const publicKey = readFileSync(
    join(process.cwd(), 'jwt-rs256-public.pem'),
    'utf8',
);

export const jwtConstants = {
    privateKey,
    publicKey
};

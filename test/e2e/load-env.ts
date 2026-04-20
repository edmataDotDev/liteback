import { config } from 'dotenv';
import { resolve } from 'node:path';

// Raíz del repo (este archivo vive en test/e2e/)
config({ path: resolve(__dirname, '../../.env') });

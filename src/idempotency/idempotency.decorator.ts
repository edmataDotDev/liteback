import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENT_ROUTE_KEY } from './idempotency.constants';

export const Idempotent = () => SetMetadata(IDEMPOTENT_ROUTE_KEY, true);

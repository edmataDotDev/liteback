export const IDEMPOTENT_ROUTE_KEY = 'idempotent_route';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

export const IDEMPOTENCY_STATUS = {
  PROCESSING: 'processing',
  FAILED: 'failed',
  COMPLETED: 'completed',
} as const;

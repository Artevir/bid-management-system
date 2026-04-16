import { createHash } from 'node:crypto';

const IDEMPOTENCY_KEY_HEADERS = ['idempotency-key', 'x-idempotency-key'];
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue(source[key]);
        return acc;
      }, {});
  }
  return value;
}

export function extractIdempotencyKey(headers: Headers): string | null {
  for (const header of IDEMPOTENCY_KEY_HEADERS) {
    const value = headers.get(header)?.trim();
    if (value) {
      return value.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
    }
  }
  return null;
}

export function buildIdempotencyDigest(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(payload)))
    .digest('hex');
}

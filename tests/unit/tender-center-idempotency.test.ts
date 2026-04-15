import { describe, expect, it } from 'vitest';
import {
  buildIdempotencyDigest,
  extractIdempotencyKey,
} from '@/app/api/tender-center/_idempotency';

describe('Tender Center Idempotency Utils', () => {
  it('extracts Idempotency-Key from standard header', () => {
    const headers = new Headers({ 'idempotency-key': 'idem-123' });
    expect(extractIdempotencyKey(headers)).toBe('idem-123');
  });

  it('extracts Idempotency-Key from x-idempotency-key header', () => {
    const headers = new Headers({ 'x-idempotency-key': 'idem-456' });
    expect(extractIdempotencyKey(headers)).toBe('idem-456');
  });

  it('builds stable digest for same payload with different key order', () => {
    const a = buildIdempotencyDigest({
      versionId: 'v1',
      projectId: 1,
      payload: {
        note: 'n',
        decision: 'approved',
      },
    });

    const b = buildIdempotencyDigest({
      payload: {
        decision: 'approved',
        note: 'n',
      },
      projectId: 1,
      versionId: 'v1',
    });

    expect(a).toBe(b);
  });
});

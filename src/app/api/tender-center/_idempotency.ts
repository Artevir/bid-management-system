import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bidInterpretationLogs } from '@/db/schema';

const IDEMPOTENCY_KEY_HEADERS = ['idempotency-key', 'x-idempotency-key'];
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

type IdempotencySnapshot<T> = {
  key: string;
  requestDigest: string;
  response: T;
  recordedAt: string;
};

type LookupResult<T> = { status: 'miss' } | { status: 'hit'; response: T } | { status: 'conflict' };

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

function parseSnapshot<T>(raw: string | null): IdempotencySnapshot<T> | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as IdempotencySnapshot<T>;
  } catch {
    return null;
  }
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

export async function lookupIdempotentResponse<T>(params: {
  interpretationId: number;
  operationType: string;
  idempotencyKey: string;
  requestDigest: string;
}): Promise<LookupResult<T>> {
  const rows = await db
    .select({
      operationContent: bidInterpretationLogs.operationContent,
    })
    .from(bidInterpretationLogs)
    .where(
      and(
        eq(bidInterpretationLogs.interpretationId, params.interpretationId),
        eq(bidInterpretationLogs.operationType, params.operationType)
      )
    )
    .orderBy(desc(bidInterpretationLogs.createdAt))
    .limit(20);

  for (const row of rows) {
    const snapshot = parseSnapshot<T>(row.operationContent);
    if (!snapshot || snapshot.key !== params.idempotencyKey) {
      continue;
    }
    if (snapshot.requestDigest !== params.requestDigest) {
      return { status: 'conflict' };
    }
    return { status: 'hit', response: snapshot.response };
  }

  return { status: 'miss' };
}

export async function recordIdempotentResponse<T>(params: {
  interpretationId: number;
  operationType: string;
  idempotencyKey: string;
  requestDigest: string;
  response: T;
  userId: number;
}) {
  const snapshot: IdempotencySnapshot<T> = {
    key: params.idempotencyKey,
    requestDigest: params.requestDigest,
    response: params.response,
    recordedAt: new Date().toISOString(),
  };

  await db.insert(bidInterpretationLogs).values({
    interpretationId: params.interpretationId,
    operationType: params.operationType,
    operationContent: JSON.stringify(snapshot),
    operatorId: params.userId,
    operatorName: 'system',
  });
}

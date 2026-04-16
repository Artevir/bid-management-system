import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { objectChangeLogs } from '@/db/schema';

const TC_IDEM_TARGET_TYPE = 'tender_center_idempotency';

type IdempotencySnapshot<T> = {
  idemOp: string;
  idemKey: string;
  idemDigest: string;
  response: T;
  recordedAt: string;
};

export type HubIdemLookup<T> =
  | { status: 'miss' }
  | { status: 'hit'; response: T }
  | { status: 'conflict' };

function parseSnapshot<T>(raw: unknown): IdempotencySnapshot<T> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.idemOp !== 'string' ||
    typeof o.idemKey !== 'string' ||
    typeof o.idemDigest !== 'string'
  ) {
    return null;
  }
  return o as IdempotencySnapshot<T>;
}

/** 用 object_change_log 承载幂等快照（target = 版本维度） */
export async function lookupHubIdempotentResponse<T>(params: {
  tenderProjectVersionId: number;
  idemOp: string;
  idempotencyKey: string;
  requestDigest: string;
}): Promise<HubIdemLookup<T>> {
  const rows = await db
    .select({ afterJson: objectChangeLogs.afterJson, id: objectChangeLogs.id })
    .from(objectChangeLogs)
    .where(
      and(
        eq(objectChangeLogs.targetObjectType, TC_IDEM_TARGET_TYPE),
        eq(objectChangeLogs.targetObjectId, params.tenderProjectVersionId)
      )
    )
    .orderBy(desc(objectChangeLogs.id))
    .limit(40);

  for (const row of rows) {
    const snap = parseSnapshot<T>(row.afterJson);
    if (!snap || snap.idemOp !== params.idemOp) continue;
    if (snap.idemKey !== params.idempotencyKey) continue;
    if (snap.idemDigest !== params.requestDigest) return { status: 'conflict' };
    return { status: 'hit', response: snap.response };
  }
  return { status: 'miss' };
}

export async function recordHubIdempotentResponse<T>(params: {
  tenderProjectVersionId: number;
  idemOp: string;
  idempotencyKey: string;
  requestDigest: string;
  response: T;
  userId: number;
}): Promise<void> {
  const snapshot: IdempotencySnapshot<T> = {
    idemOp: params.idemOp,
    idemKey: params.idempotencyKey,
    idemDigest: params.requestDigest,
    response: params.response,
    recordedAt: new Date().toISOString(),
  };
  await db.insert(objectChangeLogs).values({
    targetObjectType: TC_IDEM_TARGET_TYPE,
    targetObjectId: params.tenderProjectVersionId,
    changeType: 'create',
    afterJson: snapshot,
    operatorId: params.userId,
  });
}

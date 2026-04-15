import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidDocumentInterpretations, bidInterpretationLogs } from '@/db/schema';
import {
  mutateTenderSnapshotPayload,
  parseTenderSnapshotPayload,
} from '@/app/api/tender-center/_snapshot';

async function resolveSnapshot(snapshotId: string) {
  const rows = await db
    .select()
    .from(bidInterpretationLogs)
    .where(eq(bidInterpretationLogs.operationType, 'snapshot_created'));

  for (const row of rows) {
    try {
      const parsed = parseTenderSnapshotPayload(JSON.parse(row.operationContent || '{}'));
      if (parsed?.snapshotId === snapshotId) {
        return { row, payload: parsed };
      }
    } catch {
      // ignore malformed legacy log
    }
  }
  return null;
}

// 040: GET /api/tender-center/snapshots/{snapshotId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;

  return withAuth(request, async (_req, userId) => {
    const resolved = await resolveSnapshot(snapshotId);
    if (!resolved) {
      return NextResponse.json({ error: '快照不存在' }, { status: 404 });
    }
    const [interpretation] = await db
      .select({
        id: bidDocumentInterpretations.id,
        uploaderId: bidDocumentInterpretations.uploaderId,
      })
      .from(bidDocumentInterpretations)
      .where(eq(bidDocumentInterpretations.id, resolved.payload.interpretationId))
      .limit(1);
    if (!interpretation) {
      return NextResponse.json({ error: '快照对应解读不存在' }, { status: 404 });
    }
    if (interpretation.uploaderId !== userId) {
      return NextResponse.json({ error: '无权访问该快照' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: resolved.payload });
  });
}

// 040+: PATCH /api/tender-center/snapshots/{snapshotId}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;

  return withAuth(request, async (req, userId) => {
    const resolved = await resolveSnapshot(snapshotId);
    if (!resolved) {
      return NextResponse.json({ error: '快照不存在' }, { status: 404 });
    }
    const [interpretation] = await db
      .select({
        id: bidDocumentInterpretations.id,
        uploaderId: bidDocumentInterpretations.uploaderId,
      })
      .from(bidDocumentInterpretations)
      .where(eq(bidDocumentInterpretations.id, resolved.payload.interpretationId))
      .limit(1);
    if (!interpretation) {
      return NextResponse.json({ error: '快照对应解读不存在' }, { status: 404 });
    }
    if (interpretation.uploaderId !== userId) {
      return NextResponse.json({ error: '无权操作该快照' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as 'publish' | 'invalidate' | undefined;
    const name = body.name === undefined ? undefined : String(body.name);
    const note = body.note === undefined ? undefined : String(body.note);
    if (action !== undefined && action !== 'publish' && action !== 'invalidate') {
      return NextResponse.json(
        { error: 'action 非法，仅支持 publish/invalidate' },
        { status: 400 }
      );
    }
    if (action === undefined && name === undefined && note === undefined) {
      return NextResponse.json({ error: '至少提供 action 或 name/note 中的一项' }, { status: 400 });
    }

    const result = mutateTenderSnapshotPayload(
      resolved.payload,
      {
        action,
        name,
        note,
      },
      userId
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error || '快照更新被拒绝' }, { status: 409 });
    }

    await db
      .update(bidInterpretationLogs)
      .set({
        operationContent: JSON.stringify(result.payload),
        operationTime: new Date(),
        operatorId: userId,
        operatorName: 'system',
      })
      .where(eq(bidInterpretationLogs.id, resolved.row.id));

    await db.insert(bidInterpretationLogs).values({
      interpretationId: interpretation.id,
      operationType: 'snapshot_updated',
      operationContent: JSON.stringify({
        snapshotId,
        action: action || 'metadata_update',
        updatedAt: new Date().toISOString(),
        updates: {
          name: name ?? null,
          note: note ?? null,
        },
      }),
      operatorId: userId,
      operatorName: 'system',
    });

    return NextResponse.json({
      success: true,
      data: result.payload,
      message:
        action === 'publish' ? '快照已发布' : action === 'invalidate' ? '快照已失效' : '快照已更新',
    });
  });
}

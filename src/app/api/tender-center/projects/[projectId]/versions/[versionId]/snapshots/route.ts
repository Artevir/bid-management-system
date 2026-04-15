import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { db } from '@/db';
import { bidDocumentInterpretations, bidInterpretationLogs } from '@/db/schema';
import { resolveInterpretationByProjectAndVersion } from '@/app/api/tender-center/_utils';
import {
  buildIdempotencyDigest,
  extractIdempotencyKey,
  lookupIdempotentResponse,
  recordIdempotentResponse,
} from '@/app/api/tender-center/_idempotency';

const IDEM_OPERATION_TYPE = 'idem_snapshot_create';

function buildSnapshotId(interpretationId: number): string {
  return `snap-${interpretationId}-${Date.now()}`;
}

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/snapshots
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const pid = parseResourceId(projectId, '项目');

  return withAuth(request, async (_req, userId) => {
    const interpretation = await resolveInterpretationByProjectAndVersion(pid, versionId);
    if (!interpretation) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }
    if (interpretation.uploaderId !== userId) {
      return NextResponse.json({ error: '无权访问该版本' }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(bidInterpretationLogs)
      .where(
        and(
          eq(bidInterpretationLogs.interpretationId, interpretation.id),
          eq(bidInterpretationLogs.operationType, 'snapshot_created')
        )
      )
      .orderBy(desc(bidInterpretationLogs.createdAt));

    const snapshots = rows.map((row) => {
      try {
        return JSON.parse(row.operationContent || '{}');
      } catch {
        return { snapshotId: `legacy-${row.id}`, createdAt: String(row.createdAt || '') };
      }
    });

    return NextResponse.json({
      success: true,
      data: snapshots,
      meta: {
        projectId: pid,
        versionId,
        interpretationId: interpretation.id,
        total: snapshots.length,
      },
    });
  });
}

// 040: POST /api/tender-center/projects/{projectId}/versions/{versionId}/snapshots
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const pid = parseResourceId(projectId, '项目');

  return withAuth(request, async (req, userId) => {
    const interpretation = await resolveInterpretationByProjectAndVersion(pid, versionId);
    if (!interpretation) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }
    if (interpretation.uploaderId !== userId) {
      return NextResponse.json({ error: '无权操作该版本' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const idempotencyKey = extractIdempotencyKey(req.headers);
    const requestDigest = idempotencyKey
      ? buildIdempotencyDigest({
          projectId: pid,
          versionId,
          interpretationId: interpretation.id,
          name: String(body.name || ''),
          note: String(body.note || ''),
          action: 'create_snapshot',
        })
      : null;

    if (idempotencyKey && requestDigest) {
      const lookup = await lookupIdempotentResponse<{
        success: boolean;
        data: {
          snapshotId: string;
          interpretationId: number;
          projectId: number;
          versionId: string;
          name: string;
          note: string;
          createdAt: string;
          summary: {
            reviewStatus: string | null;
            parseProgress: number | null;
            checklistCount: number | null;
          };
        };
        message: string;
      }>({
        interpretationId: interpretation.id,
        operationType: IDEM_OPERATION_TYPE,
        idempotencyKey,
        requestDigest,
      });
      if (lookup.status === 'conflict') {
        return NextResponse.json(
          { error: 'Idempotency-Key 与请求参数不一致，请更换后重试' },
          { status: 409 }
        );
      }
      if (lookup.status === 'hit') {
        return NextResponse.json({
          ...lookup.response,
          idempotentReplay: true,
          message: '幂等命中，返回首次创建快照',
        });
      }
    }

    const snapshotId = buildSnapshotId(interpretation.id);
    const payload = {
      snapshotId,
      interpretationId: interpretation.id,
      projectId: pid,
      versionId,
      name: body.name || `snapshot-${new Date().toISOString()}`,
      note: body.note || '',
      createdAt: new Date().toISOString(),
      summary: {
        reviewStatus: interpretation.reviewStatus,
        parseProgress: interpretation.parseProgress,
        checklistCount: interpretation.checklistCount,
      },
    };

    await db.insert(bidInterpretationLogs).values({
      interpretationId: interpretation.id,
      operationType: 'snapshot_created',
      operationContent: JSON.stringify(payload),
      operatorId: userId,
      operatorName: 'system',
    });

    await db
      .update(bidDocumentInterpretations)
      .set({ updatedAt: new Date() })
      .where(eq(bidDocumentInterpretations.id, interpretation.id));

    const responsePayload = {
      success: true,
      data: payload,
      message: '快照已创建',
    };

    if (idempotencyKey && requestDigest) {
      await recordIdempotentResponse({
        interpretationId: interpretation.id,
        operationType: IDEM_OPERATION_TYPE,
        idempotencyKey,
        requestDigest,
        response: responsePayload,
        userId,
      });
    }

    return NextResponse.json(responsePayload);
  });
}

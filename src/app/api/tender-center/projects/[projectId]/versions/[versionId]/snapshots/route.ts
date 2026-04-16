import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { assetExportSnapshots } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import {
  buildIdempotencyDigest,
  extractIdempotencyKey,
} from '@/app/api/tender-center/_idempotency';
import {
  lookupHubIdempotentResponse,
  recordHubIdempotentResponse,
} from '@/app/api/tender-center/_hub-idempotency';
import {
  buildTenderTraceContext,
  getOrCreateTraceId,
  logTenderTraceEvent,
} from '@/app/api/tender-center/_trace';
import {
  isTenderExportMode,
  isTenderSnapshotType,
  parseTenderSnapshotPayload,
  type TenderExportMode,
  type TenderSnapshotPayload,
  type TenderSnapshotType,
} from '@/app/api/tender-center/_snapshot';

const IDEM_OPERATION_TYPE = 'idem_snapshot_create';

function buildSnapshotId(versionId: number): string {
  return `snap-hub-${versionId}-${Date.now()}`;
}

function mapSnapshotTypeToHub(
  t: TenderSnapshotType
):
  | 'requirements_snapshot'
  | 'framework_snapshot'
  | 'templates_snapshot'
  | 'materials_snapshot'
  | 'full_snapshot' {
  switch (t) {
    case 'requirements_snapshot':
      return 'requirements_snapshot';
    case 'framework_snapshot':
      return 'framework_snapshot';
    case 'templates_snapshot':
      return 'templates_snapshot';
    case 'materials_snapshot':
      return 'materials_snapshot';
    case 'full_snapshot':
    default:
      return 'full_snapshot';
  }
}

function mapExportModeToHub(
  m: TenderExportMode
): 'internal_consumption' | 'downstream_module' | 'manual_download' | 'api_delivery' {
  return m;
}

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/snapshots
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;

  return withAuth(request, async (_req, userId) => {
    const { project, version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const rows = await db.query.assetExportSnapshots.findMany({
      where: and(
        eq(assetExportSnapshots.tenderProjectVersionId, version.id),
        eq(assetExportSnapshots.isDeleted, false)
      ),
      orderBy: [desc(assetExportSnapshots.createdAt)],
    });

    const snapshots = rows.map((row) => {
      const raw = row.snapshotJson;
      if (raw && typeof raw === 'object') {
        const parsed = parseTenderSnapshotPayload(raw);
        return parsed ?? raw;
      }
      return {
        snapshotId: String(row.id),
        createdAt: String(row.createdAt || ''),
        snapshotType: row.snapshotType,
        snapshotStatus: row.snapshotStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: snapshots,
      meta: {
        projectId: project.id,
        versionId: version.id,
        interpretationId: null,
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

  return withAuth(request, async (req, userId) => {
    const { project, version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const snapshotType = String(body.snapshotType || '') as TenderSnapshotType;
    if (!isTenderSnapshotType(snapshotType)) {
      return NextResponse.json(
        {
          error:
            'snapshotType 非法，仅支持 requirements_snapshot/framework_snapshot/templates_snapshot/materials_snapshot/full_snapshot',
        },
        { status: 400 }
      );
    }
    const exportModeRaw = String(body.exportMode || 'internal_consumption') as TenderExportMode;
    if (!isTenderExportMode(exportModeRaw)) {
      return NextResponse.json(
        {
          error:
            'exportMode 非法，仅支持 internal_consumption/downstream_module/manual_download/api_delivery',
        },
        { status: 400 }
      );
    }

    const traceId = getOrCreateTraceId(req.headers);
    const batchId = `snap-trace-${version.id}`;
    const idempotencyKey = extractIdempotencyKey(req.headers);
    const requestDigest = idempotencyKey
      ? buildIdempotencyDigest({
          projectId: project.id,
          versionId: version.id,
          name: String(body.name || ''),
          note: String(body.note || ''),
          snapshotType,
          exportMode: exportModeRaw,
          action: 'create_snapshot',
        })
      : null;

    if (idempotencyKey && requestDigest) {
      const lookup = await lookupHubIdempotentResponse<{
        success: boolean;
        data: TenderSnapshotPayload & { traceId?: string; batchId?: string };
        message: string;
      }>({
        tenderProjectVersionId: version.id,
        idemOp: IDEM_OPERATION_TYPE,
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
          traceId,
          batchId,
          message: '幂等命中，返回首次创建快照',
        });
      }
    }

    const snapshotId = buildSnapshotId(version.id);
    const payload: TenderSnapshotPayload = {
      snapshotId,
      interpretationId: 0,
      projectId: project.id,
      versionId: String(version.id),
      name: body.name || `snapshot-${new Date().toISOString()}`,
      note: body.note || '',
      snapshotType,
      exportMode: exportModeRaw,
      status: 'generated',
      createdAt: new Date().toISOString(),
      publishedAt: null,
      publishedBy: null,
      invalidatedAt: null,
      invalidatedBy: null,
      summary: {
        reviewStatus: null,
        parseProgress: null,
        checklistCount: null,
      },
    };

    await db.insert(assetExportSnapshots).values({
      tenderProjectVersionId: version.id,
      snapshotType: mapSnapshotTypeToHub(snapshotType),
      snapshotStatus: 'generated',
      exportMode: mapExportModeToHub(exportModeRaw),
      snapshotJson: payload as unknown as Record<string, unknown>,
      schemaVersion: 'hub-1',
      exportedAt: new Date(),
      exportedBy: userId,
    });

    await logTenderTraceEvent({
      interpretationId: null,
      userId,
      trace: buildTenderTraceContext({
        interpretationId: null,
        traceId,
        taskId: snapshotId,
        event: 'snapshot_created',
        batchId,
      }),
      detail: {
        projectId: project.id,
        versionId: version.id,
      },
    });

    const responsePayload = {
      success: true,
      data: {
        ...payload,
        traceId,
        batchId,
      },
      message: '快照已创建',
    };

    if (idempotencyKey && requestDigest) {
      await recordHubIdempotentResponse({
        tenderProjectVersionId: version.id,
        idemOp: IDEM_OPERATION_TYPE,
        idempotencyKey,
        requestDigest,
        response: responsePayload,
        userId,
      });
    }

    return NextResponse.json(responsePayload);
  });
}

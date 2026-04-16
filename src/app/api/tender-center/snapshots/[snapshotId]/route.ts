import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { assetExportSnapshots, tenderProjects, tenderProjectVersions } from '@/db/schema';
import {
  mutateTenderSnapshotPayload,
  parseTenderSnapshotPayload,
  type TenderSnapshotPayload,
} from '@/app/api/tender-center/_snapshot';
import {
  buildTenderTraceContext,
  getOrCreateTraceId,
  logTenderTraceEvent,
} from '@/app/api/tender-center/_trace';
import {
  HubGovernanceTargetType,
  recordHubPatchGovernance,
} from '@/lib/tender-center/hub-governance';

type HubSnapshotRow = {
  id: number;
  tenderProjectVersionId: number;
  snapshotType:
    | 'requirements_snapshot'
    | 'framework_snapshot'
    | 'templates_snapshot'
    | 'materials_snapshot'
    | 'full_snapshot'
    | 'full_asset'
    | 'requirements_only'
    | 'risks_only'
    | 'templates_only'
    | 'custom';
  snapshotStatus:
    | 'generating'
    | 'generated'
    | 'published'
    | 'invalidated'
    | 'draft'
    | 'building'
    | 'ready'
    | 'failed'
    | 'superseded';
  exportMode:
    | 'internal_consumption'
    | 'downstream_module'
    | 'manual_download'
    | 'api_delivery'
    | 'json'
    | 'excel'
    | 'word'
    | 'pdf_bundle'
    | 'other';
  snapshotJson: unknown;
  exportedAt: Date | null;
  createdAt: Date;
  projectId: number;
  projectCreatedBy: number | null;
};

function mapHubSnapshotTypeToPayload(
  value: HubSnapshotRow['snapshotType']
): TenderSnapshotPayload['snapshotType'] {
  switch (value) {
    case 'requirements_snapshot':
      return 'requirements_snapshot';
    case 'framework_snapshot':
      return 'framework_snapshot';
    case 'templates_snapshot':
      return 'templates_snapshot';
    case 'materials_snapshot':
      return 'materials_snapshot';
    case 'full_snapshot':
      return 'full_snapshot';
    case 'requirements_only':
      return 'requirements_snapshot';
    case 'templates_only':
      return 'templates_snapshot';
    case 'custom':
      return 'framework_snapshot';
    case 'risks_only':
      return 'materials_snapshot';
    case 'full_asset':
    default:
      return 'full_snapshot';
  }
}

function mapHubExportModeToPayload(
  value: HubSnapshotRow['exportMode']
): TenderSnapshotPayload['exportMode'] {
  if (value === 'internal_consumption') return 'internal_consumption';
  if (value === 'downstream_module') return 'downstream_module';
  if (value === 'manual_download') return 'manual_download';
  if (value === 'api_delivery') return 'api_delivery';
  if (value === 'excel') return 'manual_download';
  if (value === 'json') return 'api_delivery';
  return 'internal_consumption';
}

function mapHubSnapshotStatusToPayload(
  value: HubSnapshotRow['snapshotStatus']
): TenderSnapshotPayload['status'] {
  if (value === 'generated') return 'generated';
  if (value === 'published') return 'published';
  if (value === 'invalidated') return 'invalidated';
  if (value === 'superseded') return 'invalidated';
  return 'generated';
}

function mapPayloadStatusToHub(
  value: TenderSnapshotPayload['status']
): HubSnapshotRow['snapshotStatus'] {
  if (value === 'invalidated') return 'invalidated';
  if (value === 'published') return 'published';
  return 'generated';
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildPayload(row: HubSnapshotRow): TenderSnapshotPayload {
  if (isObjectRecord(row.snapshotJson)) {
    const parsed = parseTenderSnapshotPayload(row.snapshotJson);
    if (parsed) return parsed;
  }

  const raw = isObjectRecord(row.snapshotJson) ? row.snapshotJson : {};
  const summaryRaw = isObjectRecord(raw.summary) ? raw.summary : {};
  const snapshotId = typeof raw.snapshotId === 'string' ? raw.snapshotId : `snap-hub-${row.id}`;

  return {
    snapshotId,
    interpretationId: 0,
    projectId: row.projectId,
    versionId: String(row.tenderProjectVersionId),
    name: typeof raw.name === 'string' ? raw.name : `snapshot-${row.id}`,
    note: typeof raw.note === 'string' ? raw.note : '',
    snapshotType: mapHubSnapshotTypeToPayload(row.snapshotType),
    exportMode: mapHubExportModeToPayload(row.exportMode),
    status: mapHubSnapshotStatusToPayload(row.snapshotStatus),
    createdAt: row.exportedAt?.toISOString() || row.createdAt.toISOString(),
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    publishedBy: typeof raw.publishedBy === 'number' ? raw.publishedBy : null,
    invalidatedAt: typeof raw.invalidatedAt === 'string' ? raw.invalidatedAt : null,
    invalidatedBy: typeof raw.invalidatedBy === 'number' ? raw.invalidatedBy : null,
    summary: {
      reviewStatus: typeof summaryRaw.reviewStatus === 'string' ? summaryRaw.reviewStatus : null,
      parseProgress: typeof summaryRaw.parseProgress === 'number' ? summaryRaw.parseProgress : null,
      checklistCount:
        typeof summaryRaw.checklistCount === 'number' ? summaryRaw.checklistCount : null,
    },
  };
}

async function resolveSnapshot(snapshotId: string): Promise<HubSnapshotRow | null> {
  const numericId = Number(snapshotId);
  const baseSelect = {
    id: assetExportSnapshots.id,
    tenderProjectVersionId: assetExportSnapshots.tenderProjectVersionId,
    snapshotType: assetExportSnapshots.snapshotType,
    snapshotStatus: assetExportSnapshots.snapshotStatus,
    exportMode: assetExportSnapshots.exportMode,
    snapshotJson: assetExportSnapshots.snapshotJson,
    exportedAt: assetExportSnapshots.exportedAt,
    createdAt: assetExportSnapshots.createdAt,
    projectId: tenderProjects.id,
    projectCreatedBy: tenderProjects.createdBy,
  };

  if (Number.isFinite(numericId) && numericId > 0) {
    const byId = await db
      .select(baseSelect)
      .from(assetExportSnapshots)
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, assetExportSnapshots.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(and(eq(assetExportSnapshots.id, numericId), eq(assetExportSnapshots.isDeleted, false)))
      .limit(1);
    if (byId[0]) return byId[0] as HubSnapshotRow;
  }

  const byPayloadId = await db
    .select(baseSelect)
    .from(assetExportSnapshots)
    .innerJoin(
      tenderProjectVersions,
      eq(tenderProjectVersions.id, assetExportSnapshots.tenderProjectVersionId)
    )
    .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
    .where(
      and(
        sql`${assetExportSnapshots.snapshotJson} ->> 'snapshotId' = ${snapshotId}`,
        eq(assetExportSnapshots.isDeleted, false)
      )
    )
    .limit(1);
  return (byPayloadId[0] as HubSnapshotRow | undefined) ?? null;
}

// 040: GET /api/tender-center/snapshots/{snapshotId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;

  return withAuth(request, async (_req, userId) => {
    const row = await resolveSnapshot(snapshotId);
    if (!row) {
      return NextResponse.json({ error: '快照不存在' }, { status: 404 });
    }
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return NextResponse.json({ error: '无权访问该快照' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: buildPayload(row) });
  });
}

// 040+: PATCH /api/tender-center/snapshots/{snapshotId}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const { snapshotId } = await params;

  return withAuth(request, async (req, userId) => {
    const row = await resolveSnapshot(snapshotId);
    if (!row) {
      return NextResponse.json({ error: '快照不存在' }, { status: 404 });
    }
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return NextResponse.json({ error: '无权操作该快照' }, { status: 403 });
    }

    const currentPayload = buildPayload(row);
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
      currentPayload,
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

    const traceId = getOrCreateTraceId(req.headers);
    await db
      .update(assetExportSnapshots)
      .set({
        snapshotStatus: mapPayloadStatusToHub(result.payload.status),
        snapshotJson: result.payload as unknown as Record<string, unknown>,
        exportedAt: new Date(),
        exportedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assetExportSnapshots.id, row.id),
          eq(assetExportSnapshots.tenderProjectVersionId, row.tenderProjectVersionId)
        )
      );

    const afterRow = await resolveSnapshot(String(row.id));
    const afterPayload = afterRow ? buildPayload(afterRow) : result.payload;

    await recordHubPatchGovernance({
      operatorId: userId,
      tenderProjectVersionId: row.tenderProjectVersionId,
      targetObjectType: HubGovernanceTargetType.assetExportSnapshot,
      targetObjectId: row.id,
      beforeJson: {
        hubSnapshotId: row.id,
        tenderProjectVersionId: row.tenderProjectVersionId,
        snapshotType: row.snapshotType,
        snapshotStatus: row.snapshotStatus,
        exportMode: row.exportMode,
        payload: currentPayload,
      },
      afterJson: {
        hubSnapshotId: row.id,
        tenderProjectVersionId: row.tenderProjectVersionId,
        snapshotType: afterRow?.snapshotType ?? row.snapshotType,
        snapshotStatus: afterRow?.snapshotStatus ?? mapPayloadStatusToHub(result.payload.status),
        exportMode: afterRow?.exportMode ?? row.exportMode,
        payload: afterPayload,
      },
    });

    await logTenderTraceEvent({
      interpretationId: null,
      userId,
      trace: buildTenderTraceContext({
        interpretationId: null,
        traceId,
        taskId: result.payload.snapshotId,
        event: action === 'invalidate' ? 'snapshot_invalidated' : 'snapshot_updated',
        batchId: `snapshot-${row.id}`,
      }),
      detail: {
        snapshotId: result.payload.snapshotId,
        action: action || 'metadata_update',
        tenderProjectVersionId: row.tenderProjectVersionId,
      },
    });

    return NextResponse.json({
      success: true,
      data: result.payload,
      traceId,
      message:
        action === 'publish' ? '快照已发布' : action === 'invalidate' ? '快照已失效' : '快照已更新',
    });
  });
}

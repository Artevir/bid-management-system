import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { documentParseBatches } from '@/db/schema';
import { toHubDocumentParseBatchId } from '@/app/api/tender-center/_utils';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import type { TenderBatchStatus } from '@/lib/interpretation/status-machine';

function mapHubBatchStatus(status: string): TenderBatchStatus {
  switch (status) {
    case 'running':
    case 'partial':
      return 'running';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
    case 'cancelled':
      return 'failed';
    case 'queued':
    default:
      return 'pending';
  }
}

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/batches
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

    const rows = await db.query.documentParseBatches.findMany({
      where: eq(documentParseBatches.tenderProjectVersionId, version.id),
      orderBy: [desc(documentParseBatches.createdAt)],
    });

    const data = rows.map((row) => ({
      batchId: toHubDocumentParseBatchId(row.id),
      interpretationId: null as number | null,
      documentParseBatchId: row.id,
      status: mapHubBatchStatus(row.batchStatus),
      progress: row.batchStatus === 'succeeded' ? 100 : row.batchStatus === 'running' ? 50 : 0,
      startedAt: row.parseStartedAt,
      completedAt: row.parseFinishedAt,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        projectId: project.id,
        versionId: version.id,
        total: data.length,
      },
    });
  });
}

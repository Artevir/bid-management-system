import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubDocumentParseBatchContext } from '@/app/api/tender-center/_utils';
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

// 040: GET /api/tender-center/batches/{batchId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  return withAuth(request, async (_req, userId) => {
    const hub = await resolveHubDocumentParseBatchContext(batchId);
    if (!hub) {
      return NextResponse.json({ error: '批次不存在（仅支持 hub-batch-*）' }, { status: 404 });
    }
    if (hub.project.createdBy && hub.project.createdBy !== userId) {
      return NextResponse.json({ error: '无权访问该批次' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        interpretationId: null,
        documentParseBatchId: hub.batch.id,
        tenderProjectVersionId: hub.version.id,
        status: mapHubBatchStatus(hub.batch.batchStatus),
        progress:
          hub.batch.batchStatus === 'succeeded'
            ? 100
            : hub.batch.batchStatus === 'running'
              ? 50
              : 0,
        parseError: null,
        createdAt: hub.batch.createdAt,
        updatedAt: hub.batch.updatedAt,
      },
    });
  });
}

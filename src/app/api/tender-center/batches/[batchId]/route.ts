import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { resolveInterpretationByBatchId } from '@/app/api/tender-center/_utils';
import { toTenderBatchStatus } from '@/lib/interpretation/status-machine';

// 040: GET /api/tender-center/batches/{batchId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  return withAuth(request, async (_req, userId) => {
    const interpretation = await resolveInterpretationByBatchId(batchId);
    if (!interpretation) {
      return NextResponse.json({ error: '批次不存在' }, { status: 404 });
    }
    if (interpretation.uploaderId !== userId) {
      return NextResponse.json({ error: '无权访问该批次' }, { status: 403 });
    }
    return NextResponse.json({
      success: true,
      data: {
        batchId,
        interpretationId: interpretation.id,
        status: toTenderBatchStatus(interpretation.status),
        progress: interpretation.parseProgress ?? 0,
        parseError: interpretation.parseError,
        createdAt: interpretation.createdAt,
        updatedAt: interpretation.updatedAt,
      },
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import {
  resolveInterpretationByProjectAndVersion,
  toBatchId,
} from '@/app/api/tender-center/_utils';
import { toTenderBatchStatus } from '@/lib/interpretation/status-machine';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/batches
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

    const batch = {
      batchId: toBatchId(interpretation.id),
      interpretationId: interpretation.id,
      status: toTenderBatchStatus(interpretation.status),
      progress: interpretation.parseProgress ?? 0,
      startedAt: interpretation.updatedAt,
      completedAt: interpretation.status === 'completed' ? interpretation.updatedAt : null,
    };

    return NextResponse.json({
      success: true,
      data: [batch],
      meta: {
        projectId: pid,
        versionId,
        total: 1,
      },
    });
  });
}

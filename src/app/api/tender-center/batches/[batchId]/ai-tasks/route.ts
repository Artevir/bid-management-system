import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { aiTaskRuns } from '@/db/schema';
import { resolveHubDocumentParseBatchContext } from '@/app/api/tender-center/_utils';

function mapHubBatchStatus(status: string) {
  switch (status) {
    case 'running':
    case 'partially_succeeded':
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

// 040: GET /api/tender-center/batches/{batchId}/ai-tasks
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

    const runs = await db.query.aiTaskRuns.findMany({
      where: eq(aiTaskRuns.documentParseBatchId, hub.batch.id),
      orderBy: [desc(aiTaskRuns.createdAt)],
      limit: 50,
    });
    const batchStatus = mapHubBatchStatus(hub.batch.batchStatus);
    const tasks = runs.map((run) => ({
      taskId: `ai-run-${run.id}`,
      taskType: run.taskType,
      status: run.taskStatus ?? batchStatus,
      batchId,
      traceId: null,
      content: {
        modelProvider: run.modelProvider,
        modelName: run.modelName,
        taskStatus: run.taskStatus,
        errorMessage: run.errorMessage,
      },
      executedAt: run.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: tasks,
      meta: {
        batchId,
        interpretationId: null,
        documentParseBatchId: hub.batch.id,
        total: tasks.length,
      },
    });
  });
}

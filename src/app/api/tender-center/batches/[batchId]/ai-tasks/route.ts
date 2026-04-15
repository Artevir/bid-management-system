import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidInterpretationLogs } from '@/db/schema';
import { resolveInterpretationByBatchId } from '@/app/api/tender-center/_utils';
import { toTenderBatchStatus } from '@/lib/interpretation/status-machine';

// 040: GET /api/tender-center/batches/{batchId}/ai-tasks
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

    const logs = await db
      .select()
      .from(bidInterpretationLogs)
      .where(eq(bidInterpretationLogs.interpretationId, interpretation.id))
      .orderBy(desc(bidInterpretationLogs.operationTime))
      .limit(50);

    const batchStatus = toTenderBatchStatus(interpretation.status);
    const tasks = logs.map((log) => ({
      taskId: `task-${log.id}`,
      taskType: log.operationType,
      status: batchStatus,
      content: log.operationContent,
      executedAt: log.operationTime,
    }));

    return NextResponse.json({
      success: true,
      data: tasks,
      meta: { batchId, interpretationId: interpretation.id, total: tasks.length },
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { reviewTasks, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { parseHubReviewTaskId } from '@/app/api/tender-center/_utils';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 060: POST /api/tender-center/reviews/{reviewTaskId}/reassign
// reassign_review 重新分派复核任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewTaskId: string }> }
) {
  const { reviewTaskId } = await params;
  const taskId = parseHubReviewTaskId(reviewTaskId);
  if (!taskId) {
    return tenderCenterError('无效的 reviewTaskId', 400);
  }

  return withAuth(request, async (req, userId) => {
    const body = await req.json().catch(() => ({}));
    const newAssigneeId = Number(body.assigneeId) || null;
    const note = String(body.note || '').trim();

    const [task] = await db.select().from(reviewTasks).where(eq(reviewTasks.id, taskId)).limit(1);

    if (!task) {
      return tenderCenterError('复核任务不存在', 404);
    }

    const versionRows = await db
      .select({ projectCreatedBy: tenderProjects.createdBy })
      .from(tenderProjectVersions)
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(eq(tenderProjectVersions.id, task.tenderProjectVersionId))
      .limit(1);

    if (versionRows[0]?.projectCreatedBy && versionRows[0].projectCreatedBy !== userId) {
      return tenderCenterError('无权操作该复核任务', 403);
    }

    await db
      .update(reviewTasks)
      .set({
        assignedTo: newAssigneeId,
        reviewStatus: 'assigned',
        ...(note ? { reviewComment: note } : {}),
        updatedAt: new Date(),
      })
      .where(eq(reviewTasks.id, taskId));

    return NextResponse.json({
      success: true,
      data: {
        reviewTaskId,
        previousAssignee: task.assignedTo,
        newAssignee: newAssigneeId,
        action: 'reassign_review',
      },
      message: '复核任务重新分派成功',
    });
  });
}

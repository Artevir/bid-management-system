import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { reviewTasks } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { toHubReviewTaskId } from '@/app/api/tender-center/_utils';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/reviews
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  return withAuth(request, async (_req, userId) => {
    const { version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const logs = await db.query.reviewTasks.findMany({
      where: eq(reviewTasks.tenderProjectVersionId, version.id),
      orderBy: [desc(reviewTasks.createdAt)],
      limit: 100,
    });

    const data = logs.map((row) => ({
      reviewLogId: row.id,
      reviewTaskId: toHubReviewTaskId(row.id),
      type: row.reviewReason,
      content: row.comment,
      operatorId: row.assignedTo,
      operatorName: null as string | null,
      operationTime: row.reviewedAt ?? row.createdAt,
      reviewStatus: row.reviewStatus,
      reviewResult: row.reviewResult,
    }));

    return NextResponse.json({ success: true, data });
  });
}

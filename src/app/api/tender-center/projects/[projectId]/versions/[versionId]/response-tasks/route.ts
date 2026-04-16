import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { responseTaskItems } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/response-tasks
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

    const rows = await db.query.responseTaskItems.findMany({
      where: and(
        eq(responseTaskItems.tenderProjectVersionId, version.id),
        eq(responseTaskItems.isDeleted, false)
      ),
    });

    const tasks = rows.map((row) => ({
      taskId: row.id,
      requirementId: null as number | null,
      title: row.taskTitle,
      priority: row.priorityLevel,
      status: row.status,
      taskType: row.taskType,
    }));

    return NextResponse.json({ success: true, data: tasks });
  });
}

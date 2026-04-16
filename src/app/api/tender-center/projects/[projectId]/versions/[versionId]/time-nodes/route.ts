import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { timeNodes } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/time-nodes
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
    const data = await db.query.timeNodes.findMany({
      where: and(eq(timeNodes.tenderProjectVersionId, version.id), eq(timeNodes.isDeleted, false)),
    });
    return NextResponse.json({ success: true, data });
  });
}

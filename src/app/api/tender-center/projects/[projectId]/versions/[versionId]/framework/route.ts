import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { bidFrameworkNodes } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/framework
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
    const rows = await db.query.bidFrameworkNodes.findMany({
      where: and(
        eq(bidFrameworkNodes.tenderProjectVersionId, version.id),
        eq(bidFrameworkNodes.isDeleted, false)
      ),
      orderBy: [asc(bidFrameworkNodes.orderNo), asc(bidFrameworkNodes.id)],
    });
    const data = rows.map((row) => ({
      nodeId: row.id,
      id: row.id,
      parentId: row.parentId,
      title: row.frameworkTitle,
      chapterNumber: row.frameworkNo,
      level: row.levelNo,
      type: row.contentType,
      requiredType: row.requiredType,
      reviewStatus: row.reviewStatus,
      sortOrder: row.orderNo,
    }));
    return NextResponse.json({ success: true, data });
  });
}

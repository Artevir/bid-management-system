import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { documentSectionNodes } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/sections
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
    const rows = await db.query.documentSectionNodes.findMany({
      where: and(
        eq(documentSectionNodes.tenderProjectVersionId, version.id),
        eq(documentSectionNodes.isDeleted, false)
      ),
      orderBy: [asc(documentSectionNodes.orderNo), asc(documentSectionNodes.id)],
    });
    const data = rows.map((row) => ({
      sectionId: row.id,
      title: row.sectionTitle,
      number: row.sectionNo,
      level: row.headingLevel,
      parentSectionId: row.parentId,
      pageNumber: row.startPageNo,
      pathText: row.pathText,
    }));
    return NextResponse.json({ success: true, data });
  });
}

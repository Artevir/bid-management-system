import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { documentPages, sourceDocuments, sourceSegments } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/pages
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

    const counts = await db
      .select({
        pageNo: documentPages.pageNo,
        segmentCount: sql<number>`count(${sourceSegments.id})`,
      })
      .from(documentPages)
      .innerJoin(sourceDocuments, eq(sourceDocuments.id, documentPages.sourceDocumentId))
      .leftJoin(sourceSegments, eq(sourceSegments.documentPageId, documentPages.id))
      .where(
        and(
          eq(sourceDocuments.tenderProjectVersionId, version.id),
          eq(sourceDocuments.isDeleted, false)
        )
      )
      .groupBy(documentPages.pageNo);

    const data = counts
      .filter((c) => c.pageNo != null)
      .sort((a, b) => (a.pageNo ?? 0) - (b.pageNo ?? 0))
      .map((c) => ({
        pageNumber: c.pageNo,
        segmentCount: Number(c.segmentCount ?? 0),
      }));

    return NextResponse.json({ success: true, data });
  });
}

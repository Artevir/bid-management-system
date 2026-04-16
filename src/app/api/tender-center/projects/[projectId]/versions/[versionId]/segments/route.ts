import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { sourceDocuments, sourceSegments } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/segments
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

    const docs = await db.query.sourceDocuments.findMany({
      where: and(
        eq(sourceDocuments.tenderProjectVersionId, version.id),
        eq(sourceDocuments.isDeleted, false)
      ),
    });
    const docIds = docs.map((d) => d.id);
    if (docIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const rows = await db.query.sourceSegments.findMany({
      where: and(
        inArray(sourceSegments.sourceDocumentId, docIds),
        eq(sourceSegments.isDeleted, false)
      ),
      orderBy: [asc(sourceSegments.orderNo), asc(sourceSegments.id)],
    });

    const data = rows.map((row) => ({
      segmentId: row.id,
      sectionId: row.documentPageId,
      text: row.rawText || row.normalizedText || '',
      pageNumber: null as number | null,
      level: row.headingLevel,
    }));

    return NextResponse.json({ success: true, data });
  });
}

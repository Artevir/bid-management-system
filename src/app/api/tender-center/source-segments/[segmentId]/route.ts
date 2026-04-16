import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  documentPages,
  sourceDocuments,
  sourceSegments,
  tenderProjects,
  tenderProjectVersions,
} from '@/db/schema';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 040: GET /api/tender-center/source-segments/{segmentId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segmentId: string }> }
) {
  const { segmentId } = await params;
  let id = 0;
  try {
    id = parseResourceId(segmentId, '分段');
  } catch (error) {
    if (error instanceof AppError) {
      return tenderCenterError(error.message, error.statusCode);
    }
    return tenderCenterError('无效的 segmentId', 400);
  }
  return withAuth(request, async (_req, userId) => {
    const rows = await db
      .select({
        id: sourceSegments.id,
        text: sourceSegments.rawText,
        normalizedText: sourceSegments.normalizedText,
        pageNo: documentPages.pageNo,
        documentPageId: sourceSegments.documentPageId,
        isHeading: sourceSegments.isHeading,
        headingLevel: sourceSegments.headingLevel,
        segmentType: sourceSegments.segmentType,
        sectionPath: sourceSegments.sectionPath,
        projectCreatedBy: tenderProjects.createdBy,
      })
      .from(sourceSegments)
      .innerJoin(sourceDocuments, eq(sourceDocuments.id, sourceSegments.sourceDocumentId))
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, sourceDocuments.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .leftJoin(documentPages, eq(documentPages.id, sourceSegments.documentPageId))
      .where(and(eq(sourceSegments.id, id), eq(sourceSegments.isDeleted, false)))
      .limit(1);
    const row = rows[0];
    if (!row) return tenderCenterError('分片不存在', 404);
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return tenderCenterError('无权访问该分片', 403);
    }
    return NextResponse.json({
      success: true,
      data: {
        segmentId: row.id,
        text: row.text || row.normalizedText || '',
        pageNumber: row.pageNo,
        sectionId: row.documentPageId,
        nodeId: null,
        segmentType: row.segmentType,
        isHeading: row.isHeading,
        headingLevel: row.headingLevel,
        sectionPath: row.sectionPath,
      },
    });
  });
}

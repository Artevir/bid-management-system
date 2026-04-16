import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidFrameworkNodes, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 040: GET /api/tender-center/framework/{nodeId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  let id = 0;
  try {
    id = parseResourceId(nodeId, '框架节点');
  } catch (error) {
    if (error instanceof AppError) {
      return tenderCenterError(error.message, error.statusCode);
    }
    return tenderCenterError('无效的 nodeId', 400);
  }
  return withAuth(request, async (_req, userId) => {
    const rows = await db
      .select({
        id: bidFrameworkNodes.id,
        frameworkTitle: bidFrameworkNodes.frameworkTitle,
        frameworkNo: bidFrameworkNodes.frameworkNo,
        contentType: bidFrameworkNodes.contentType,
        levelNo: bidFrameworkNodes.levelNo,
        parentId: bidFrameworkNodes.parentId,
        requiredType: bidFrameworkNodes.requiredType,
        reviewStatus: bidFrameworkNodes.reviewStatus,
        sourceSegmentId: bidFrameworkNodes.sourceSegmentId,
        projectCreatedBy: tenderProjects.createdBy,
      })
      .from(bidFrameworkNodes)
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, bidFrameworkNodes.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(and(eq(bidFrameworkNodes.id, id), eq(bidFrameworkNodes.isDeleted, false)))
      .limit(1);
    const row = rows[0];
    if (!row) return tenderCenterError('节点不存在', 404);
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return tenderCenterError('无权访问该节点', 403);
    }
    return NextResponse.json({
      success: true,
      data: {
        nodeId: row.id,
        chapterTitle: row.frameworkTitle,
        chapterNumber: row.frameworkNo,
        chapterType: row.contentType,
        level: row.levelNo,
        parentId: row.parentId,
        requiredType: row.requiredType,
        reviewStatus: row.reviewStatus,
        sourceSegmentId: row.sourceSegmentId,
      },
    });
  });
}

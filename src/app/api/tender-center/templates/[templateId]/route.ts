import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { hubBidTemplates, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 040: GET /api/tender-center/templates/{templateId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  let id = 0;
  try {
    id = parseResourceId(templateId, '模板');
  } catch (error) {
    if (error instanceof AppError) {
      return tenderCenterError(error.message, error.statusCode);
    }
    return tenderCenterError('无效的 templateId', 400);
  }
  return withAuth(request, async (_req, userId) => {
    const rows = await db
      .select({
        id: hubBidTemplates.id,
        templateName: hubBidTemplates.templateName,
        templateType: hubBidTemplates.templateType,
        sourceTitle: hubBidTemplates.sourceTitle,
        templateText: hubBidTemplates.templateText,
        templateHtml: hubBidTemplates.templateHtml,
        templateTableJson: hubBidTemplates.templateTableJson,
        sourceSegmentId: hubBidTemplates.sourceSegmentId,
        sourcePageNo: hubBidTemplates.sourcePageNo,
        fixedFormatFlag: hubBidTemplates.fixedFormatFlag,
        originalFormatRequiredFlag: hubBidTemplates.originalFormatRequiredFlag,
        signatureRequiredFlag: hubBidTemplates.signatureRequiredFlag,
        sealRequiredFlag: hubBidTemplates.sealRequiredFlag,
        dateRequiredFlag: hubBidTemplates.dateRequiredFlag,
        reviewStatus: hubBidTemplates.reviewStatus,
        projectCreatedBy: tenderProjects.createdBy,
      })
      .from(hubBidTemplates)
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, hubBidTemplates.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(and(eq(hubBidTemplates.id, id), eq(hubBidTemplates.isDeleted, false)))
      .limit(1);
    const row = rows[0];
    if (!row) return tenderCenterError('模板不存在', 404);
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return tenderCenterError('无权访问该模板', 403);
    }
    return NextResponse.json({
      success: true,
      data: {
        templateId: row.id,
        name: row.templateName,
        category: row.templateType,
        sourceTitle: row.sourceTitle,
        content: row.templateText,
        html: row.templateHtml,
        table: row.templateTableJson,
        sourceSegmentId: row.sourceSegmentId,
        pageNumber: row.sourcePageNo,
        fixedFormatFlag: row.fixedFormatFlag,
        originalFormatRequiredFlag: row.originalFormatRequiredFlag,
        signatureRequiredFlag: row.signatureRequiredFlag,
        sealRequiredFlag: row.sealRequiredFlag,
        dateRequiredFlag: row.dateRequiredFlag,
        reviewStatus: row.reviewStatus,
      },
    });
  });
}

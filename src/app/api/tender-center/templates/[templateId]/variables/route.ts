import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  hubBidTemplates,
  templateVariables,
  tenderProjects,
  tenderProjectVersions,
} from '@/db/schema';
import { extractTemplateVariables } from '@/app/api/tender-center/_view';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 040: GET /api/tender-center/templates/{templateId}/variables
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
        templateText: hubBidTemplates.templateText,
        templateHtml: hubBidTemplates.templateHtml,
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

    const structuredVars = await db.query.templateVariables.findMany({
      where: eq(templateVariables.bidTemplateId, row.id),
    });
    if (structuredVars.length > 0) {
      return NextResponse.json({
        success: true,
        data: structuredVars.map((v) => ({
          variableId: v.id,
          name: v.variableName,
          label: v.variableLabel,
          type: v.variableType,
          required: v.requiredFlag,
          repeatable: v.repeatableFlag,
          editable: v.editableFlag,
          reviewStatus: v.reviewStatus,
        })),
        meta: { templateId: row.id, templateName: row.templateName, total: structuredVars.length },
      });
    }

    const text = [row.templateName || '', row.templateText || '', row.templateHtml || ''].join(
      '\n'
    );
    const vars = extractTemplateVariables(text);

    return NextResponse.json({
      success: true,
      data: vars.map((name) => ({ name })),
      meta: { templateId: row.id, templateName: row.templateName, total: vars.length },
    });
  });
}

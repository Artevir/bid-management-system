import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  formTableStructures,
  hubBidTemplates,
  templateBlocks,
  templateVariableBindings,
  templateVariables,
  tenderProjects,
  tenderProjectVersions,
} from '@/db/schema';
import { parseResourceId } from '@/lib/api/validators';
import { AppError } from '@/lib/api/error-handler';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 040: GET /api/tender-center/templates/{templateId}/structure
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

    const [blocks, vars, forms] = await Promise.all([
      db.query.templateBlocks.findMany({
        where: and(eq(templateBlocks.bidTemplateId, row.id), eq(templateBlocks.isDeleted, false)),
      }),
      db.query.templateVariables.findMany({
        where: and(
          eq(templateVariables.bidTemplateId, row.id),
          eq(templateVariables.isDeleted, false)
        ),
      }),
      db.query.formTableStructures.findMany({
        where: and(
          eq(formTableStructures.bidTemplateId, row.id),
          eq(formTableStructures.isDeleted, false)
        ),
      }),
    ]);

    const varIds = vars.map((v) => v.id);
    const bindings =
      varIds.length === 0
        ? []
        : await db.query.templateVariableBindings.findMany({
            where: and(
              inArray(templateVariableBindings.templateVariableId, varIds),
              eq(templateVariableBindings.isDeleted, false)
            ),
          });

    return NextResponse.json({
      success: true,
      data: {
        templateId: row.id,
        templateName: row.templateName,
        blocks: blocks.map((b) => ({
          blockId: b.id,
          blockType: b.blockType,
          orderNo: b.orderNo,
          blockText: b.blockText,
          blockTableJson: b.blockTableJson,
          sourceSegmentId: b.sourceSegmentId,
        })),
        variables: vars.map((v) => ({
          variableId: v.id,
          variableName: v.variableName,
          variableLabel: v.variableLabel,
          variableType: v.variableType,
          requiredFlag: v.requiredFlag,
          repeatableFlag: v.repeatableFlag,
          sourceBlockId: v.sourceBlockId,
          sourceSegmentId: v.sourceSegmentId,
          defaultValueHint: v.defaultValueHint,
          replacementRule: v.replacementRule,
          editableFlag: v.editableFlag,
          reviewStatus: v.reviewStatus,
        })),
        variableBindings: bindings.map((b) => ({
          bindingId: b.id,
          templateVariableId: b.templateVariableId,
          bindingTargetType: b.bindingTargetType,
          bindingKey: b.bindingKey,
          fallbackStrategy: b.fallbackStrategy,
          note: b.note,
        })),
        formTableStructures: forms.map((f) => ({
          structureId: f.id,
          tableName: f.tableName,
          rowNo: f.rowNo,
          colNo: f.colNo,
          cellKey: f.cellKey,
          cellLabel: f.cellLabel,
          cellType: f.cellType,
          requiredFlag: f.requiredFlag,
          sourceSegmentId: f.sourceSegmentId,
        })),
      },
    });
  });
}

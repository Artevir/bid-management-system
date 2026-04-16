import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import {
  hubBidTemplates,
  templateBlocks,
  templateVariables,
  templateVariableBindings,
} from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/template-detail
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

    const templates = await db.query.hubBidTemplates.findMany({
      where: and(
        eq(hubBidTemplates.tenderProjectVersionId, version.id),
        eq(hubBidTemplates.isDeleted, false)
      ),
    });

    const tplIds = templates.map((t) => t.id);

    const blocks =
      tplIds.length > 0
        ? await db.query.templateBlocks.findMany({
            where: and(eq(templateBlocks.isDeleted, false)),
          })
        : [];

    const variables =
      tplIds.length > 0
        ? await db.query.templateVariables.findMany({
            where: and(eq(templateVariables.isDeleted, false)),
          })
        : [];

    const varIds = variables.map((v) => v.id);
    const bindings =
      varIds.length > 0
        ? await db.query.templateVariableBindings.findMany({
            where: eq(templateVariableBindings.isDeleted, false),
          })
        : [];

    const templateData = templates.map((tpl) => {
      const tplBlocks = blocks.filter((b) => b.bidTemplateId === tpl.id);
      const tplVars = variables.filter((v) => v.bidTemplateId === tpl.id);
      const varIds = tplVars.map((v) => v.id);
      const tplBindings = bindings.filter((b) => varIds.includes(b.templateVariableId));

      return {
        templateId: tpl.id,
        templateName: tpl.templateName,
        templateType: tpl.templateType,
        sourceTitle: tpl.sourceTitle,
        templateText: tpl.templateText,
        fixedFormatFlag: tpl.fixedFormatFlag,
        originalFormatRequiredFlag: tpl.originalFormatRequiredFlag,
        signatureRequiredFlag: tpl.signatureRequiredFlag,
        sealRequiredFlag: tpl.sealRequiredFlag,
        dateRequiredFlag: tpl.dateRequiredFlag,
        reviewStatus: tpl.reviewStatus,
        blocks: tplBlocks.map((b) => ({
          blockId: b.id,
          blockType: b.blockType,
          orderNo: b.orderNo,
          blockText: b.blockText,
        })),
        variables: tplVars.map((v) => ({
          variableId: v.id,
          variableName: v.variableName,
          variableLabel: v.variableLabel,
          variableType: v.variableType,
          requiredFlag: v.requiredFlag,
          editableFlag: v.editableFlag,
          bindings: tplBindings
            .filter((b) => b.templateVariableId === v.id)
            .map((b) => ({
              bindingId: b.id,
              bindingTargetType: b.bindingTargetType,
              bindingKey: b.bindingKey,
            })),
        })),
      };
    });

    return NextResponse.json({ success: true, data: templateData });
  });
}

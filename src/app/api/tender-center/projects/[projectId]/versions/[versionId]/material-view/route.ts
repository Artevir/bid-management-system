import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  hubBidTemplates,
  scoringItems,
  scoringSchemes,
  submissionMaterials,
  templateVariableBindings,
  templateVariables,
} from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/material-view
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

    const [materialRows, templateRows, scoringCountRow, signatureCountRow, sealCountRow] =
      await Promise.all([
        db.query.submissionMaterials.findMany({
          where: and(
            eq(submissionMaterials.tenderProjectVersionId, version.id),
            eq(submissionMaterials.isDeleted, false)
          ),
        }),
        db.query.hubBidTemplates.findMany({
          where: and(
            eq(hubBidTemplates.tenderProjectVersionId, version.id),
            eq(hubBidTemplates.isDeleted, false)
          ),
        }),
        db
          .select({ count: sql<number>`count(*)` })
          .from(scoringItems)
          .innerJoin(scoringSchemes, eq(scoringSchemes.id, scoringItems.scoringSchemeId))
          .where(
            and(
              eq(scoringSchemes.tenderProjectVersionId, version.id),
              eq(scoringSchemes.isDeleted, false),
              eq(scoringItems.isDeleted, false)
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(submissionMaterials)
          .where(
            and(
              eq(submissionMaterials.tenderProjectVersionId, version.id),
              eq(submissionMaterials.isDeleted, false),
              eq(submissionMaterials.needSignatureFlag, true)
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(submissionMaterials)
          .where(
            and(
              eq(submissionMaterials.tenderProjectVersionId, version.id),
              eq(submissionMaterials.isDeleted, false),
              eq(submissionMaterials.needSealFlag, true)
            )
          ),
      ]);

    const total = materialRows.length;
    const mandatory = materialRows.filter((r) => r.requiredFlag).length;
    const byCategory = new Map<string, number>();
    for (const row of materialRows) {
      const key = row.materialType || 'other';
      byCategory.set(key, (byCategory.get(key) || 0) + 1);
    }

    const materialList = materialRows.map((m) => ({
      materialId: m.id,
      materialName: m.materialName,
      materialType: m.materialType,
      requiredFlag: m.requiredFlag,
      needSignatureFlag: m.needSignatureFlag,
      needSealFlag: m.needSealFlag,
      sourceReason: m.sourceReason,
      relatedRequirementId: m.relatedRequirementId,
      relatedScoringItemId: m.relatedScoringItemId,
      relatedTemplateId: m.relatedTemplateId,
      reviewStatus: m.reviewStatus,
    }));

    const relatedTemplateIds = materialRows
      .map((m) => m.relatedTemplateId)
      .filter(Boolean) as number[];
    const relatedTemplateNames = templateRows
      .filter((t) => relatedTemplateIds.includes(t.id))
      .map((t) => ({ id: t.id, name: t.templateName }));

    return NextResponse.json({
      success: true,
      data: {
        totalMaterials: total,
        mandatoryMaterials: mandatory,
        optionalMaterials: total - mandatory,
        categories: Array.from(byCategory.entries()).map(([category, count]) => ({
          category,
          count,
        })),
        relatedScoringItemCount: Number(scoringCountRow[0]?.count ?? 0),
        relatedTemplateCount: templateRows.length,
        signatureRequiredCount: Number(signatureCountRow[0]?.count ?? 0),
        sealRequiredCount: Number(sealCountRow[0]?.count ?? 0),
        materialList,
        relatedTemplates: relatedTemplateNames,
      },
    });
  });
}

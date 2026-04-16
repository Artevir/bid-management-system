import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { tenderCenterError } from '@/app/api/tender-center/_response';
import { db } from '@/db';
import {
  submissionMaterials,
  scoringItems,
  tenderRequirements,
  hubBidTemplates,
} from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/materials
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
    const data = await db.query.submissionMaterials.findMany({
      where: and(
        eq(submissionMaterials.tenderProjectVersionId, version.id),
        eq(submissionMaterials.isDeleted, false)
      ),
    });
    return NextResponse.json({ success: true, data });
  });
}

// 060: POST /api/tender-center/projects/{projectId}/versions/{versionId}/materials
// materialize_requirement 转材料清单
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  return withAuth(request, async (req, userId) => {
    const { version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return tenderCenterError('未找到对应版本', 404);
    }

    const body = await req.json().catch(() => ({}));
    const sourceType = String(body.sourceType || '');
    const sourceId = Number(body.sourceId);

    if (!sourceType || !sourceId) {
      return tenderCenterError('缺少必要参数 sourceType 或 sourceId', 400);
    }

    const validSources = ['requirement', 'scoring_item', 'template'];
    if (!validSources.includes(sourceType)) {
      return tenderCenterError('无效的 sourceType', 400);
    }

    let materialName = '';
    const materialType: 'original' | 'qualification_material' | 'other' = 'other';
    const required = true;

    if (sourceType === 'requirement') {
      const [reqRow] = await db
        .select({ title: tenderRequirements.title })
        .from(tenderRequirements)
        .where(
          and(
            eq(tenderRequirements.id, sourceId),
            eq(tenderRequirements.tenderProjectVersionId, version.id)
          )
        )
        .limit(1);
      if (!reqRow) {
        return tenderCenterError('源要求不存在', 404);
      }
      materialName = reqRow.title || `要求 #${sourceId}`;
    } else if (sourceType === 'scoring_item') {
      const [scoreRow] = await db
        .select({ itemName: scoringItems.itemName })
        .from(scoringItems)
        .where(and(eq(scoringItems.id, sourceId)))
        .limit(1);
      if (!scoreRow) {
        return tenderCenterError('源评分项不存在', 404);
      }
      materialName = scoreRow.itemName || `评分项 #${sourceId}`;
    } else if (sourceType === 'template') {
      const [tmplRow] = await db
        .select({ templateName: hubBidTemplates.templateName })
        .from(hubBidTemplates)
        .where(
          and(
            eq(hubBidTemplates.id, sourceId),
            eq(hubBidTemplates.tenderProjectVersionId, version.id)
          )
        )
        .limit(1);
      if (!tmplRow) {
        return tenderCenterError('源模板不存在', 404);
      }
      materialName = tmplRow.templateName || `模板 #${sourceId}`;
    }

    const [newMaterial] = await db
      .insert(submissionMaterials)
      .values({
        tenderProjectVersionId: version.id,
        materialName,
        materialType,
        requiredFlag: required,
        needSignatureFlag: body.needSignature || false,
        needSealFlag: body.needSeal || false,
        reviewStatus: 'draft',
        ...(sourceType === 'requirement' ? { relatedRequirementId: sourceId } : {}),
        ...(sourceType === 'scoring_item' ? { relatedScoringItemId: sourceId } : {}),
        ...(sourceType === 'template' ? { relatedTemplateId: sourceId } : {}),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        materialId: newMaterial.id,
        sourceType,
        sourceId,
        name: materialName,
        type: materialType,
        action: 'materialize_requirement',
      },
      message: '材料清单创建成功',
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  commercialRequirements,
  qualificationRequirements,
  technicalRequirements,
  tenderProjects,
  tenderProjectVersions,
  tenderRequirements,
} from '@/db/schema';
import { tenderCenterError } from '@/app/api/tender-center/_response';

function parseRequirementId(value: string): number | null {
  const normalized = value.startsWith('req-') ? value.slice(4) : value;
  const id = Number(normalized);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 040: GET /api/tender-center/requirements/{requirementId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requirementId: string }> }
) {
  const { requirementId } = await params;
  const id = parseRequirementId(requirementId);
  if (!id) {
    return tenderCenterError('无效的 requirementId', 400);
  }
  return withAuth(request, async (_req, userId) => {
    const rows = await db
      .select({
        id: tenderRequirements.id,
        category: tenderRequirements.requirementType,
        subCategory: tenderRequirements.requirementSubtype,
        title: tenderRequirements.title,
        description: tenderRequirements.content,
        requirementDetail: tenderRequirements.normalizedContent,
        status: tenderRequirements.reviewStatus,
        mandatory: tenderRequirements.importanceLevel,
        originalText: tenderRequirements.content,
        pageNumber: tenderRequirements.sourcePageNo,
        projectCreatedBy: tenderProjects.createdBy,
      })
      .from(tenderRequirements)
      .innerJoin(
        tenderProjectVersions,
        eq(tenderProjectVersions.id, tenderRequirements.tenderProjectVersionId)
      )
      .innerJoin(tenderProjects, eq(tenderProjects.id, tenderProjectVersions.tenderProjectId))
      .where(and(eq(tenderRequirements.id, id), eq(tenderRequirements.isDeleted, false)))
      .limit(1);
    const row = rows[0];
    if (!row) return tenderCenterError('要求不存在', 404);
    if (row.projectCreatedBy && row.projectCreatedBy !== userId) {
      return tenderCenterError('无权访问该要求', 403);
    }

    const [qualRow] = await db
      .select()
      .from(qualificationRequirements)
      .where(
        and(
          eq(qualificationRequirements.tenderRequirementId, id),
          eq(qualificationRequirements.isDeleted, false)
        )
      )
      .limit(1);
    const [commRow] = await db
      .select()
      .from(commercialRequirements)
      .where(
        and(
          eq(commercialRequirements.tenderRequirementId, id),
          eq(commercialRequirements.isDeleted, false)
        )
      )
      .limit(1);
    const [techRow] = await db
      .select()
      .from(technicalRequirements)
      .where(
        and(
          eq(technicalRequirements.tenderRequirementId, id),
          eq(technicalRequirements.isDeleted, false)
        )
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        requirementId: row.id,
        category: row.category,
        subCategory: row.subCategory,
        title: row.title,
        description: row.description,
        requirementDetail: row.requirementDetail,
        requiredValue: null,
        requiredDocuments: null,
        status: row.status,
        mandatory: row.mandatory === 'critical' || row.mandatory === 'high',
        originalText: row.originalText,
        pageNumber: row.pageNumber,
        specialization: {
          qualificationRequirement: qualRow ?? null,
          commercialRequirement: commRow ?? null,
          technicalRequirement: techRow ?? null,
        },
      },
    });
  });
}

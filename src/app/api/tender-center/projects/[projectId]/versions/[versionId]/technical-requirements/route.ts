import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { technicalRequirements, tenderRequirements } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/technical-requirements
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
    const rows = await db
      .select({
        id: technicalRequirements.id,
        requirementId: technicalRequirements.tenderRequirementId,
        technicalType: technicalRequirements.technicalType,
        categoryName: technicalRequirements.categoryName,
        requirementName: technicalRequirements.requirementName,
        requirementValue: technicalRequirements.requirementValue,
        valueType: technicalRequirements.valueType,
        unit: technicalRequirements.unit,
        starFlag: technicalRequirements.starFlag,
        allowDeviationFlag: technicalRequirements.allowDeviationFlag,
        hardConstraintFlag: technicalRequirements.hardConstraintFlag,
        proofMaterialHint: technicalRequirements.proofMaterialHint,
      })
      .from(technicalRequirements)
      .innerJoin(
        tenderRequirements,
        eq(tenderRequirements.id, technicalRequirements.tenderRequirementId)
      )
      .where(
        and(
          eq(tenderRequirements.tenderProjectVersionId, version.id),
          eq(tenderRequirements.isDeleted, false),
          eq(technicalRequirements.isDeleted, false)
        )
      );
    return NextResponse.json({ success: true, data: rows });
  });
}

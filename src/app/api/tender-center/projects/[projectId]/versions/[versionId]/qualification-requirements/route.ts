import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { qualificationRequirements, tenderRequirements } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/qualification-requirements
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
        id: qualificationRequirements.id,
        requirementId: qualificationRequirements.tenderRequirementId,
        qualificationType: qualificationRequirements.qualificationType,
        subjectScope: qualificationRequirements.subjectScope,
        yearRange: qualificationRequirements.yearRange,
        amountRequirement: qualificationRequirements.amountRequirement,
        countRequirement: qualificationRequirements.countRequirement,
        proofMaterialHint: qualificationRequirements.proofMaterialHint,
        hardConstraintFlag: qualificationRequirements.hardConstraintFlag,
      })
      .from(qualificationRequirements)
      .innerJoin(
        tenderRequirements,
        eq(tenderRequirements.id, qualificationRequirements.tenderRequirementId)
      )
      .where(
        and(
          eq(tenderRequirements.tenderProjectVersionId, version.id),
          eq(tenderRequirements.isDeleted, false),
          eq(qualificationRequirements.isDeleted, false)
        )
      );
    return NextResponse.json({ success: true, data: rows });
  });
}

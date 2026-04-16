import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { commercialRequirements, tenderRequirements } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/commercial-requirements
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
        id: commercialRequirements.id,
        requirementId: commercialRequirements.tenderRequirementId,
        commercialType: commercialRequirements.commercialType,
        amountText: commercialRequirements.amountText,
        amountValue: commercialRequirements.amountValue,
        currency: commercialRequirements.currency,
        deadlineText: commercialRequirements.deadlineText,
        deadlineTime: commercialRequirements.deadlineTime,
        methodText: commercialRequirements.methodText,
        penaltyClause: commercialRequirements.penaltyClause,
        proofMaterialHint: commercialRequirements.proofMaterialHint,
      })
      .from(commercialRequirements)
      .innerJoin(
        tenderRequirements,
        eq(tenderRequirements.id, commercialRequirements.tenderRequirementId)
      )
      .where(
        and(
          eq(tenderRequirements.tenderProjectVersionId, version.id),
          eq(tenderRequirements.isDeleted, false),
          eq(commercialRequirements.isDeleted, false)
        )
      );
    return NextResponse.json({ success: true, data: rows });
  });
}

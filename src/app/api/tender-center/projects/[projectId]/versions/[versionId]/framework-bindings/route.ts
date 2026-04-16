import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidFrameworkNodes, frameworkRequirementBindings, tenderRequirements } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET .../framework-bindings — 010 §6.2.3 框架与要求绑定
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
        bindingId: frameworkRequirementBindings.id,
        bidFrameworkNodeId: frameworkRequirementBindings.bidFrameworkNodeId,
        tenderRequirementId: frameworkRequirementBindings.tenderRequirementId,
        bindingType: frameworkRequirementBindings.bindingType,
        requiredLevel: frameworkRequirementBindings.requiredLevel,
        note: frameworkRequirementBindings.note,
        frameworkTitle: bidFrameworkNodes.frameworkTitle,
        requirementTitle: tenderRequirements.title,
        requirementType: tenderRequirements.requirementType,
      })
      .from(frameworkRequirementBindings)
      .innerJoin(
        bidFrameworkNodes,
        eq(bidFrameworkNodes.id, frameworkRequirementBindings.bidFrameworkNodeId)
      )
      .innerJoin(
        tenderRequirements,
        eq(tenderRequirements.id, frameworkRequirementBindings.tenderRequirementId)
      )
      .where(
        and(
          eq(bidFrameworkNodes.tenderProjectVersionId, version.id),
          eq(bidFrameworkNodes.isDeleted, false),
          eq(tenderRequirements.tenderProjectVersionId, version.id),
          eq(tenderRequirements.isDeleted, false),
          eq(frameworkRequirementBindings.isDeleted, false)
        )
      )
      .orderBy(asc(frameworkRequirementBindings.id));

    return NextResponse.json({ success: true, data: rows });
  });
}

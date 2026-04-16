import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { technicalSpecGroups, technicalSpecItems } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/technical-items
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
        technicalItemId: technicalSpecItems.id,
        group: technicalSpecGroups.groupName,
        name: technicalSpecItems.specName,
        requirement: technicalSpecItems.specRequirement,
        value: technicalSpecItems.specRequirement,
        unit: technicalSpecItems.unit,
        mandatory: technicalSpecItems.starFlag,
        keyParam: technicalSpecItems.starFlag,
      })
      .from(technicalSpecItems)
      .innerJoin(
        technicalSpecGroups,
        eq(technicalSpecGroups.id, technicalSpecItems.technicalSpecGroupId)
      )
      .where(
        and(
          eq(technicalSpecGroups.tenderProjectVersionId, version.id),
          eq(technicalSpecGroups.isDeleted, false),
          eq(technicalSpecItems.isDeleted, false)
        )
      );

    const data = rows.map((row) => ({ ...row, pageNumber: null as number | null }));

    return NextResponse.json({ success: true, data });
  });
}

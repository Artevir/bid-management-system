import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { technicalSpecGroups, technicalSpecItems } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/technical-groups
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
    const groups = await db.query.technicalSpecGroups.findMany({
      where: and(
        eq(technicalSpecGroups.tenderProjectVersionId, version.id),
        eq(technicalSpecGroups.isDeleted, false)
      ),
    });
    const itemCountByGroup = new Map<number, number>();
    if (groups.length > 0) {
      const groupIds = groups.map((group) => group.id);
      const items = await db
        .select({
          groupId: technicalSpecItems.technicalSpecGroupId,
        })
        .from(technicalSpecItems)
        .where(
          and(
            eq(technicalSpecItems.isDeleted, false),
            inArray(technicalSpecItems.technicalSpecGroupId, groupIds)
          )
        );
      for (const item of items) {
        itemCountByGroup.set(item.groupId, (itemCountByGroup.get(item.groupId) ?? 0) + 1);
      }
    }
    const data = groups.map((group) => ({
      groupId: group.id,
      groupName: group.groupName,
      groupType: group.groupType,
      itemCount: itemCountByGroup.get(group.id) ?? 0,
      orderNo: group.orderNo,
    }));
    return NextResponse.json({ success: true, data });
  });
}

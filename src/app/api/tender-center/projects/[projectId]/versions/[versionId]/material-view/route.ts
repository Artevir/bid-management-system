import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { submissionMaterials } from '@/db/schema';
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

    const rows = await db.query.submissionMaterials.findMany({
      where: and(
        eq(submissionMaterials.tenderProjectVersionId, version.id),
        eq(submissionMaterials.isDeleted, false)
      ),
    });

    const total = rows.length;
    const mandatory = rows.filter((r) => r.requiredFlag).length;
    const byCategory = new Map<string, number>();
    for (const row of rows) {
      const key = row.materialType;
      byCategory.set(key, (byCategory.get(key) || 0) + 1);
    }

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
      },
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { tenderRequirements } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/requirements
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;

  return withAuth(request, async (_req, userId) => {
    const { project, version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }
    const rows = await db
      .select()
      .from(tenderRequirements)
      .where(
        and(
          eq(tenderRequirements.tenderProjectVersionId, version.id),
          eq(tenderRequirements.isDeleted, false)
        )
      );

    const data = rows.map((row) => ({
      requirementId: row.id,
      category: row.requirementType,
      subCategory: row.requirementSubtype,
      title: row.title,
      description: row.content,
      mandatory: row.importanceLevel === 'critical' || row.importanceLevel === 'high',
      checkStatus: row.reviewStatus,
      requirementDetail: row.normalizedContent,
      requiredValue: null,
      requiredDocuments: null,
      originalText: row.content,
      pageNumber: row.sourcePageNo,
      sortOrder: 0,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        projectId: project.id,
        versionId: version.id,
        total: data.length,
      },
    });
  });
}

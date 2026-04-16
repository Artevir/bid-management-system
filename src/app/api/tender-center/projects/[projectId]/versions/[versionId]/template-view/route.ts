import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { hubBidTemplates, templateVariables } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/template-view
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

    const [templateRows, variableCountRow, fixedFormatCountRow, originalFormatCountRow] =
      await Promise.all([
        db.query.hubBidTemplates.findMany({
          where: and(
            eq(hubBidTemplates.tenderProjectVersionId, version.id),
            eq(hubBidTemplates.isDeleted, false)
          ),
        }),
        db
          .select({ count: sql<number>`count(*)` })
          .from(templateVariables)
          .innerJoin(hubBidTemplates, eq(hubBidTemplates.id, templateVariables.bidTemplateId))
          .where(
            and(
              eq(hubBidTemplates.tenderProjectVersionId, version.id),
              eq(hubBidTemplates.isDeleted, false),
              eq(templateVariables.isDeleted, false)
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(hubBidTemplates)
          .where(
            and(
              eq(hubBidTemplates.tenderProjectVersionId, version.id),
              eq(hubBidTemplates.isDeleted, false),
              eq(hubBidTemplates.fixedFormatFlag, true)
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(hubBidTemplates)
          .where(
            and(
              eq(hubBidTemplates.tenderProjectVersionId, version.id),
              eq(hubBidTemplates.isDeleted, false),
              eq(hubBidTemplates.originalFormatRequiredFlag, true)
            )
          ),
      ]);

    const categoryMap = new Map<string, number>();
    for (const row of templateRows) {
      const key = row.templateType || 'other';
      categoryMap.set(key, (categoryMap.get(key) || 0) + 1);
    }

    const templateList = templateRows.map((t) => ({
      templateId: t.id,
      templateName: t.templateName,
      templateType: t.templateType,
      fixedFormatFlag: t.fixedFormatFlag,
      originalFormatRequiredFlag: t.originalFormatRequiredFlag,
      signatureRequiredFlag: t.signatureRequiredFlag,
      sealRequiredFlag: t.sealRequiredFlag,
      dateRequiredFlag: t.dateRequiredFlag,
      reviewStatus: t.reviewStatus,
      sourcePageNo: t.sourcePageNo,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalTemplates: templateRows.length,
        categories: Array.from(categoryMap.entries()).map(([category, count]) => ({
          category,
          count,
        })),
        totalVariables: Number(variableCountRow[0]?.count ?? 0),
        fixedFormatCount: Number(fixedFormatCountRow[0]?.count ?? 0),
        originalFormatCount: Number(originalFormatCountRow[0]?.count ?? 0),
        templateList,
      },
    });
  });
}

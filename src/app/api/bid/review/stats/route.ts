/**
 * 审校统计API
 * GET: 获取审校覆盖率统计、问题分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidDocuments, documentReviews, complianceChecks } from '@/db/schema';
import { eq, and, desc, gte, sql, isNotNull, count } from 'drizzle-orm';

async function getReviewStats(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';

    switch (type) {
      case 'overview':
        const totalDocs = await db
          .select({ count: sql<number>`count(*)` })
          .from(bidDocuments)
          .where(eq(bidDocuments.status, 'published'));

        const reviewedDocs = await db
          .select({ count: sql<number>`count(distinct ${documentReviews.documentId})` })
          .from(documentReviews);

        const totalReviews = await db
          .select({ count: sql<number>`count(*)` })
          .from(documentReviews);

        const issueStats = await db
          .select({
            type: sql<string>`case 
              when ${complianceChecks.severity} = 'critical' then 'error'
              when ${complianceChecks.severity} = 'major' then 'warning'
              else 'info'
            end`,
            severity: complianceChecks.severity,
            count: sql<number>`count(*)`,
          })
          .from(complianceChecks)
          .groupBy(sql`case 
            when ${complianceChecks.severity} = 'critical' then 'error'
            when ${complianceChecks.severity} = 'major' then 'warning'
            else 'info'
          end`, complianceChecks.severity);

        const issuesByType = { errors: 0, warnings: 0, infos: 0 };
        issueStats.forEach((item) => {
          if (item.type === 'error') issuesByType.errors += Number(item.count);
          else if (item.type === 'warning') issuesByType.warnings += Number(item.count);
          else issuesByType.infos += Number(item.count);
        });

        const coverage = totalDocs[0]?.count 
          ? Math.round((reviewedDocs[0]?.count || 0) / totalDocs[0].count * 100)
          : 0;

        return NextResponse.json({
          success: true,
          stats: {
            totalDocuments: totalDocs[0]?.count || 0,
            reviewedDocuments: reviewedDocs[0]?.count || 0,
            totalReviews: totalReviews[0]?.count || 0,
            coverage,
            issues: issuesByType,
          },
        });

      case 'recent':
        const recentReviews = await db
          .select({
            id: documentReviews.id,
            documentId: documentReviews.documentId,
            score: documentReviews.score,
            status: documentReviews.status,
            reviewedAt: documentReviews.reviewedAt,
          })
          .from(documentReviews)
          .orderBy(desc(documentReviews.reviewedAt))
          .limit(20);

        return NextResponse.json({
          success: true,
          recent: recentReviews,
        });

      case 'issues':
        const topIssues = await db
          .select({
            id: complianceChecks.id,
            chapterId: complianceChecks.chapterId,
            ruleName: complianceChecks.ruleName,
            severity: complianceChecks.severity,
            checkResult: complianceChecks.checkResult,
            count: sql<number>`count(*)`,
          })
          .from(complianceChecks)
          .groupBy(
            complianceChecks.id,
            complianceChecks.chapterId,
            complianceChecks.ruleName,
            complianceChecks.severity,
            complianceChecks.checkResult
          )
          .orderBy(desc(sql<number>`count(*)`))
          .limit(20);

        return NextResponse.json({
          success: true,
          topIssues,
        });

      default:
        return NextResponse.json({ error: 'Invalid stats type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Review stats error:', error);
    return NextResponse.json({ error: '获取审校统计失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getReviewStats(req, userId));
}
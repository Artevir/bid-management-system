/**
 * 解读统计API
 * GET: 获取解读准确率统计、趋势数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidDocumentInterpretations } from '@/db/schema';
import { eq, and, desc, gte, sql, isNotNull } from 'drizzle-orm';

async function getInterpretationStats(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const period = searchParams.get('period') || '30d';

    const now = new Date();
    let startDate: Date | null = null;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
    }

    const conditions = [
      eq(bidDocumentInterpretations.status, 'completed'),
      isNotNull(bidDocumentInterpretations.extractAccuracy),
    ];

    if (startDate) {
      conditions.push(gte(bidDocumentInterpretations.updatedAt, startDate));
    }

    switch (type) {
      case 'overview':
        const allInterpretations = await db
          .select({
            count: sql<number>`count(*)`,
            avgAccuracy: sql<number>`avg(${bidDocumentInterpretations.extractAccuracy})`,
            minAccuracy: sql<number>`min(${bidDocumentInterpretations.extractAccuracy})`,
            maxAccuracy: sql<number>`max(${bidDocumentInterpretations.extractAccuracy})`,
          })
          .from(bidDocumentInterpretations)
          .where(and(...conditions));

        const accuracyDistribution = await db
          .select({
            accuracy: bidDocumentInterpretations.extractAccuracy,
            count: sql<number>`count(*)`,
          })
          .from(bidDocumentInterpretations)
          .where(and(...conditions));

        const distribution = {
          '90-100': 0,
          '80-90': 0,
          '70-80': 0,
          '60-70': 0,
          '0-60': 0,
        };

        accuracyDistribution.forEach((item) => {
          const acc = item.accuracy || 0;
          if (acc >= 90) distribution['90-100'] += Number(item.count);
          else if (acc >= 80) distribution['80-90'] += Number(item.count);
          else if (acc >= 70) distribution['70-80'] += Number(item.count);
          else if (acc >= 60) distribution['60-70'] += Number(item.count);
          else distribution['0-60'] += Number(item.count);
        });

        return NextResponse.json({
          success: true,
          stats: {
            totalInterpretations: allInterpretations[0]?.count || 0,
            avgAccuracy: Math.round(allInterpretations[0]?.avgAccuracy || 0),
            minAccuracy: allInterpretations[0]?.minAccuracy || 0,
            maxAccuracy: allInterpretations[0]?.maxAccuracy || 0,
            distribution,
          },
        });

      case 'recent':
        const recentInterpretations = await db
          .select({
            id: bidDocumentInterpretations.id,
            documentName: bidDocumentInterpretations.documentName,
            projectName: bidDocumentInterpretations.projectName,
            extractAccuracy: bidDocumentInterpretations.extractAccuracy,
            updatedAt: bidDocumentInterpretations.updatedAt,
          })
          .from(bidDocumentInterpretations)
          .where(and(...conditions))
          .orderBy(desc(bidDocumentInterpretations.updatedAt))
          .limit(20);

        return NextResponse.json({
          success: true,
          recent: recentInterpretations,
        });

      case 'trends':
        const trendsData = await db
          .select({
            accuracy: bidDocumentInterpretations.extractAccuracy,
            createdAt: bidDocumentInterpretations.createdAt,
          })
          .from(bidDocumentInterpretations)
          .where(and(...conditions))
          .orderBy(bidDocumentInterpretations.createdAt);

        const dailyTrends = new Map<string, { total: number; count: number }>();
        
        trendsData.forEach((item) => {
          const date = new Date(item.createdAt).toISOString().split('T')[0];
          const existing = dailyTrends.get(date) || { total: 0, count: 0 };
          dailyTrends.set(date, {
            total: existing.total + (item.accuracy || 0),
            count: existing.count + 1,
          });
        });

        const trends = Array.from(dailyTrends.entries())
          .map(([date, data]) => ({
            date,
            avgAccuracy: Math.round(data.total / data.count),
            count: data.count,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30);

        return NextResponse.json({
          success: true,
          trends,
        });

      default:
        return NextResponse.json({ error: 'Invalid stats type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Interpretation stats error:', error);
    return NextResponse.json({ error: '获取解读统计失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getInterpretationStats(req, userId));
}
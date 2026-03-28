/**
 * 审核统计 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getApprovalOverview,
  getApprovalTrend,
  getReviewerRanking,
  getProjectApprovalReport,
  exportApprovalReportCSV,
} from '@/lib/approval/stats';

// 获取审核统计
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const orgId = authResult.user!.orgId;

    // 解析日期范围
    const dateRange = startDate && endDate ? {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    } : undefined;

    switch (action) {
      case 'overview':
        const overview = await getApprovalOverview(orgId, dateRange);
        return NextResponse.json({ overview });

      case 'trend':
        if (!dateRange) {
          return NextResponse.json({ error: '需要日期范围参数' }, { status: 400 });
        }
        const trend = await getApprovalTrend(orgId, dateRange);
        return NextResponse.json({ trend });

      case 'ranking':
        const ranking = await getReviewerRanking(orgId, dateRange);
        return NextResponse.json({ ranking });

      case 'project':
        if (!projectId) {
          return NextResponse.json({ error: '需要项目ID参数' }, { status: 400 });
        }
        const report = await getProjectApprovalReport(parseInt(projectId));
        return NextResponse.json({ report });

      case 'export':
        const stats = await getApprovalOverview(orgId, dateRange);
        const csv = exportApprovalReportCSV(stats);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="approval-report.csv"',
          },
        });

      default:
        return NextResponse.json({ error: '无效操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('获取审核统计失败:', error);
    return NextResponse.json({ error: '获取审核统计失败' }, { status: 500 });
  }
}

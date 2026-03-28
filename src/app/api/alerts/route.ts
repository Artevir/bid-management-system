/**
 * 风险预警API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  alertService,
  qualificationAlertService,
  deadlineAlertService,
  complianceCheckService,
} from '@/lib/alert/service';

// GET /api/alerts - 获取预警列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const path = req.nextUrl.pathname;

    // 获取预警统计
    if (path.endsWith('/statistics')) {
      const stats = await alertService.getAlertStatistics();
      return NextResponse.json(stats);
    }

    // 获取即将到期的资质
    if (path.endsWith('/qualifications/expiring')) {
      const days = parseInt(searchParams.get('days') || '30');
      const alerts = await qualificationAlertService.getExpiringQualifications(days);
      return NextResponse.json(alerts);
    }

    // 获取已过期资质
    if (path.endsWith('/qualifications/expired')) {
      const alerts = await qualificationAlertService.getExpiredQualifications();
      return NextResponse.json(alerts);
    }

    // 获取即将到期的项目
    if (path.endsWith('/deadlines/upcoming')) {
      const days = parseInt(searchParams.get('days') || '7');
      const alerts = await deadlineAlertService.getUpcomingDeadlines(days);
      return NextResponse.json(alerts);
    }

    // 获取逾期项目
    if (path.endsWith('/deadlines/overdue')) {
      const alerts = await deadlineAlertService.getOverdueProjects();
      return NextResponse.json(alerts);
    }

    // 获取指定项目的预警
    const projectId = searchParams.get('projectId');
    if (projectId) {
      const alerts = await alertService.getProjectAlerts(parseInt(projectId));
      return NextResponse.json(alerts);
    }

    // 获取所有预警
    const alerts = await alertService.getAllAlerts();
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('获取预警列表失败:', error);
    return NextResponse.json({ error: '获取预警列表失败' }, { status: 500 });
  }
}

// POST /api/alerts/check - 执行预警检查
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    await alertService.runScheduledCheck();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('执行预警检查失败:', error);
    return NextResponse.json({ error: '执行预警检查失败' }, { status: 500 });
  }
}

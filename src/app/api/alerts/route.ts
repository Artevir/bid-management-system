/**
 * 风险预警API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withAdmin } from '@/lib/auth/middleware';
import { getUserRoles } from '@/lib/auth/permission';
import {
  alertService,
  qualificationAlertService,
  deadlineAlertService,
  complianceCheckService as _complianceCheckService,
} from '@/lib/alert/service';
import { parseResourceId } from '@/lib/api/validators';
import { hasProjectPermission } from '@/lib/project/member';

async function assertAdmin(userId: number): Promise<Response | null> {
  const roles = await getUserRoles(userId);
  const isAdmin = roles.some((r) => r.level === 0 || r.code === 'super_admin');
  if (!isAdmin) {
    return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  }
  return null;
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = parseInt(value || String(fallback), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// GET /api/alerts - 获取预警列表
export async function GET(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const path = request.nextUrl.pathname;

      if (path.endsWith('/statistics')) {
        const denied = await assertAdmin(userId);
        if (denied) return denied;
        const stats = await alertService.getAlertStatistics();
        return NextResponse.json(stats);
      }

      if (path.endsWith('/qualifications/expiring')) {
        const denied = await assertAdmin(userId);
        if (denied) return denied;
        const days = clampInt(searchParams.get('days'), 30, 1, 365);
        const alerts = await qualificationAlertService.getExpiringQualifications(days);
        return NextResponse.json(alerts);
      }

      if (path.endsWith('/qualifications/expired')) {
        const denied = await assertAdmin(userId);
        if (denied) return denied;
        const alerts = await qualificationAlertService.getExpiredQualifications();
        return NextResponse.json(alerts);
      }

      if (path.endsWith('/deadlines/upcoming')) {
        const denied = await assertAdmin(userId);
        if (denied) return denied;
        const days = clampInt(searchParams.get('days'), 7, 1, 90);
        const alerts = await deadlineAlertService.getUpcomingDeadlines(days);
        return NextResponse.json(alerts);
      }

      if (path.endsWith('/deadlines/overdue')) {
        const denied = await assertAdmin(userId);
        if (denied) return denied;
        const alerts = await deadlineAlertService.getOverdueProjects();
        return NextResponse.json(alerts);
      }

      const projectIdRaw = searchParams.get('projectId');
      if (projectIdRaw) {
        const projectId = parseResourceId(projectIdRaw, '项目');
        const allowed = await hasProjectPermission(projectId, userId, 'view');
        if (!allowed) {
          return NextResponse.json({ error: '无权访问该项目' }, { status: 403 });
        }
        const alerts = await alertService.getProjectAlerts(projectId);
        return NextResponse.json(alerts);
      }

      const denied = await assertAdmin(userId);
      if (denied) return denied;
      const alerts = await alertService.getAllAlerts();
      return NextResponse.json(alerts);
    } catch (error) {
      console.error('获取预警列表失败:', error);
      return NextResponse.json({ error: '获取预警列表失败' }, { status: 500 });
    }
  });
}

// POST /api/alerts - 执行预警检查（全局任务，仅管理员）
export async function POST(_req: NextRequest) {
  return withAdmin(_req, async () => {
    try {
      await alertService.runScheduledCheck();
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('执行预警检查失败:', error);
      return NextResponse.json({ error: '执行预警检查失败' }, { status: 500 });
    }
  });
}

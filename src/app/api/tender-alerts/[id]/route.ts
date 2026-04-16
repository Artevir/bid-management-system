/**
 * 预警详情API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getAlertById, markAlertAsRead, dismissAlert } from '@/lib/tender-subscription/service';
import { parseIdFromParams } from '@/lib/api/validators';

// GET /api/tender-alerts/[id] - 获取预警详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const alertId = parseIdFromParams(p, 'id', '预警');

      const alert = await getAlertById(alertId);

      if (!alert) {
        return NextResponse.json({ error: '预警不存在' }, { status: 404 });
      }

      if (alert.userId !== userId) {
        return NextResponse.json({ error: '无权访问此预警' }, { status: 403 });
      }

      return NextResponse.json(alert);
    } catch (error) {
      console.error('获取预警详情失败:', error);
      return NextResponse.json({ error: '获取预警详情失败' }, { status: 500 });
    }
  });
}

// PUT /api/tender-alerts/[id] - 更新预警状态
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const alertId = parseIdFromParams(p, 'id', '预警');

      const alert = await getAlertById(alertId);
      if (!alert) {
        return NextResponse.json({ error: '预警不存在' }, { status: 404 });
      }
      if (alert.userId !== userId) {
        return NextResponse.json({ error: '无权操作此预警' }, { status: 403 });
      }

      const body = await req.json();

      if (body.action === 'read') {
        const updated = await markAlertAsRead(alertId);
        return NextResponse.json(updated);
      }

      if (body.action === 'dismiss') {
        const updated = await dismissAlert(alertId);
        return NextResponse.json(updated);
      }

      return NextResponse.json({ error: '未知操作' }, { status: 400 });
    } catch (error) {
      console.error('更新预警状态失败:', error);
      return NextResponse.json({ error: '更新预警状态失败' }, { status: 500 });
    }
  });
}

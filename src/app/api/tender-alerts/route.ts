/**
 * 预警记录API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getAlerts,
  getAlertById,
  markAlertAsRead,
  markAlertsAsRead,
  dismissAlert,
  getUnreadAlertCount,
  type AlertType,
} from '@/lib/tender-subscription/service';

// GET /api/tender-alerts - 获取预警列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    // 特殊路由：获取未读数量
    if (searchParams.get('action') === 'unread-count') {
      const count = await getUnreadAlertCount(session.user.id);
      return NextResponse.json({ count });
    }

    const filters = {
      userId: session.user.id,
      status: searchParams.get('status') as 'pending' | 'sent' | 'read' | 'dismissed' | undefined,
      alertType: searchParams.get('alertType') as AlertType | undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    };

    const result = await getAlerts(filters);

    return NextResponse.json({ data: result.data, total: result.total });
  } catch (error) {
    console.error('获取预警列表失败:', error);
    return NextResponse.json({ error: '获取预警列表失败' }, { status: 500 });
  }
}

// POST /api/tender-alerts - 批量操作
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    if (body.action === 'mark-all-read') {
      await markAlertsAsRead(session.user.id, body.ids);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('批量操作失败:', error);
    return NextResponse.json({ error: '批量操作失败' }, { status: 500 });
  }
}

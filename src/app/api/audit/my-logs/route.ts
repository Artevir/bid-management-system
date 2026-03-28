/**
 * 用户自己的操作日志API
 * GET: 获取当前用户的操作日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getUserAuditLogs } from '@/lib/audit/service';

async function getMyLogs(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const actions = searchParams.get('actions')?.split(',') as any[];

    const logs = await getUserAuditLogs(userId, { limit, actions });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Get user logs error:', error);
    return NextResponse.json({ error: '获取操作日志失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getMyLogs);
}

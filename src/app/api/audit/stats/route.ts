/**
 * 审计日志统计API
 * GET: 获取审计日志统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { getAuditLogStats } from '@/lib/audit/service';

async function getStats(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const stats = await getAuditLogStats(startDate, endDate);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get audit stats error:', error);
    return NextResponse.json({ error: '获取统计信息失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAdmin(request, getStats);
}

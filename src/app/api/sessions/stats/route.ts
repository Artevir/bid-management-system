/**
 * 会话统计API（管理员）
 * GET: 获取会话统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { getSessionStats } from '@/lib/session/service';

async function getStats(_request: NextRequest, _userId: number): Promise<NextResponse> {
  try {
    const stats = await getSessionStats();
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get session stats error:', error);
    return NextResponse.json({ error: '获取会话统计失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAdmin(request, getStats);
}

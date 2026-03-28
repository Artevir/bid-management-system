/**
 * 统一申请列表API路由
 * GET /api/support/applications - 获取所有申请列表（授权、样机、价格、友司支持）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getUnifiedApplications,
  getUnifiedApplicationStatistics,
} from '@/lib/unified-application/service';

// GET - 获取统一申请列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    // 特殊路由：统计信息
    if (searchParams.get('stats') === 'true') {
      const stats = await getUnifiedApplicationStatistics();
      return NextResponse.json(stats);
    }

    const type = searchParams.get('type') as 'authorization' | 'sample' | 'price' | 'partner' | null || undefined;
    const status = searchParams.get('status') || undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const handlerId = searchParams.get('handlerId') ? parseInt(searchParams.get('handlerId')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await getUnifiedApplications({
      type,
      status,
      keyword,
      handlerId,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取统一申请列表失败:', error);
    return NextResponse.json({ error: '获取统一申请列表失败' }, { status: 500 });
  }
}

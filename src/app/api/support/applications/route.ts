/**
 * 统一申请列表API路由
 * GET /api/support/applications - 获取所有申请列表（授权、样机、价格、友司支持）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getUnifiedApplications,
  getUnifiedApplicationStatistics,
} from '@/lib/unified-application/service';

// GET - 获取统一申请列表
export async function GET(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const searchParams = request.nextUrl.searchParams;

      if (searchParams.get('stats') === 'true') {
        const stats = await getUnifiedApplicationStatistics({ handlerId: userId });
        return NextResponse.json(stats);
      }

      const type =
        (searchParams.get('type') as 'authorization' | 'sample' | 'price' | 'partner' | null) ||
        undefined;
      const status = searchParams.get('status') || undefined;
      const keyword = searchParams.get('keyword') || undefined;
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = parseInt(searchParams.get('pageSize') || '20');

      // 统一申请聚合接口默认只返回当前用户经办数据，避免跨模块数据横向暴露
      const result = await getUnifiedApplications({
        type,
        status,
        keyword,
        handlerId: userId,
        page,
        pageSize,
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error('获取统一申请列表失败:', error);
      return NextResponse.json({ error: '获取统一申请列表失败' }, { status: 500 });
    }
  });
}

/**
 * 全文搜索 API
 */

import { NextRequest, NextResponse } from 'next/server';
import SearchService from '@/lib/search/search-service';
import { getUserIdFromRequest } from '@/lib/auth/rbac-middleware';

// ============================================
// GET - 执行搜索
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q') || '';
    const type = (searchParams.get('type') as any) || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const sortBy = (searchParams.get('sortBy') as any) || 'relevance';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';

    // 解析过滤条件
    const filters: Record<string, any> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith('filter.')) {
        const filterKey = key.substring(7);
        filters[filterKey] = value;
      }
    });

    // 执行搜索
    const results = await SearchService.search({
      query,
      type,
      page,
      pageSize,
      filters,
      sortBy,
      sortOrder,
    });

    // 记录搜索历史（需要用户登录）
    try {
      const userId = await getUserIdFromRequest(request);
      if (userId) {
        await SearchService.recordSearchHistory(userId, query, results.total);
      }
    } catch {
      // 忽略错误
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[Search API] 搜索失败:', error);
    return NextResponse.json({
      success: false,
      error: '搜索失败',
    }, { status: 500 });
  }
}

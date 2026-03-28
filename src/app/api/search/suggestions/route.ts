/**
 * 搜索建议和热门搜索 API
 */

import { NextRequest, NextResponse } from 'next/server';
import SearchService from '@/lib/search/search-service';

// ============================================
// GET - 获取搜索建议
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'suggestions';

    if (action === 'suggestions') {
      const query = searchParams.get('q') || '';
      const suggestions = await SearchService.generateSuggestions(query);

      return NextResponse.json({
        success: true,
        data: {
          query,
          suggestions,
        },
      });
    }

    if (action === 'popular') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const popularSearches = await SearchService.getPopularSearches(limit);

      return NextResponse.json({
        success: true,
        data: {
          popular: popularSearches,
        },
      });
    }

    if (action === 'history') {
      const userId = searchParams.get('userId');
      if (!userId) {
        return NextResponse.json({
          success: false,
          error: '缺少 userId 参数',
        }, { status: 400 });
      }

      const limit = parseInt(searchParams.get('limit') || '10');
      const history = await SearchService.getSearchHistory(userId, limit);

      return NextResponse.json({
        success: true,
        data: {
          userId,
          history,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: '未知的操作',
    }, { status: 400 });
  } catch (error) {
    console.error('[Search API] 请求失败:', error);
    return NextResponse.json({
      success: false,
      error: '请求失败',
    }, { status: 500 });
  }
}

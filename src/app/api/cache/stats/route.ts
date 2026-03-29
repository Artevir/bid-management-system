/**
 * 缓存统计API
 * 用于监控缓存命中率和使用情况
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { CacheService } from '@/lib/cache/service';

/**
 * 获取缓存统计信息
 * GET /api/cache/stats
 */
async function getCacheStats(_request: NextRequest, _userId: number): Promise<NextResponse> {
  const stats = CacheService.getStats();
  
  return NextResponse.json({
    success: true,
    data: {
      ...stats,
      hitRatePercent: (stats.hitRate * 100).toFixed(2) + '%',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * 清空缓存
 * POST /api/cache/stats
 */
async function clearCache(_request: NextRequest, _userId: number): Promise<NextResponse> {
  CacheService.clearAll();
  
  return NextResponse.json({
    success: true,
    message: '缓存已清空',
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, getCacheStats);
}

export async function POST(request: NextRequest) {
  return withAuth(request, clearCache);
}

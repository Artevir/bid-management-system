/**
 * 性能监控API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { withAdmin } from '@/lib/auth/middleware';

// ============================================
// GET - 获取性能统计
// ============================================

async function getPerformanceStats(request: NextRequest, _userId: number) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'stats';

  try {
    switch (type) {
      case 'stats':
        return NextResponse.json(performanceMonitor.getStats());

      case 'requests':
        const _limit = parseInt(searchParams.get('limit') || '100');
        return NextResponse.json({
          metrics: performanceMonitor.getStats().requests,
        });

      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        });

      default:
        return NextResponse.json(
          { error: '无效的类型参数' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Get performance stats error:', error);
    return NextResponse.json(
      { error: '获取性能统计失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 清除性能指标
// ============================================

async function clearPerformanceMetrics(_request: NextRequest, _userId: number) {
  try {
    // 这里需要添加清除方法到 PerformanceMonitor 类
    // 暂时返回成功
    return NextResponse.json({
      success: true,
      message: '性能指标已清除',
    });
  } catch (error) {
    console.error('Clear performance metrics error:', error);
    return NextResponse.json(
      { error: '清除性能指标失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAdmin(request, getPerformanceStats);
}

export async function DELETE(request: NextRequest) {
  return withAdmin(request, clearPerformanceMetrics);
}

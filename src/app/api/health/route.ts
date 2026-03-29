/**
 * 系统监控API
 * 提供健康检查和性能指标
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { getCacheStats } from '@/lib/cache';
import { memoryCache as _memoryCache } from '@/lib/cache';

/**
 * 健康检查API
 * GET /api/health
 */
export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // 检查数据库连接
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // 检查缓存
  try {
    const _cacheStats = getCacheStats();
    checks.cache = {
      status: 'healthy',
      latency: 0,
    };
  } catch (error) {
    checks.cache = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // 检查内存使用
  const memUsage = process.memoryUsage();
  checks.memory = {
    status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
    latency: 0,
  };

  // 计算总体状态
  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
  const overallStatus = allHealthy ? 'healthy' : 'degraded';

  // 构建响应
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    checks,
    metrics: {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      cache: getCacheStats(),
    },
    responseTime: Date.now() - startTime,
  };

  return NextResponse.json(response, {
    status: overallStatus === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

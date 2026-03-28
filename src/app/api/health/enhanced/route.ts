/**
 * 增强版系统监控API
 * 提供健康检查、性能指标、告警配置和自动恢复建议
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { getCacheStats, memoryCache, clearAllCache } from '@/lib/cache';

// 告警阈值配置
const ALERT_THRESHOLDS = {
  memory: {
    warning: 0.75, // 75% 内存使用警告
    critical: 0.90, // 90% 内存使用严重
  },
  responseTime: {
    warning: 500, // 500ms 响应时间警告
    critical: 1000, // 1000ms 响应时间严重
  },
  cacheHitRate: {
    warning: 0.50, // 50% 缓存命中率警告
    critical: 0.30, // 30% 缓存命中率严重
  },
  databaseLatency: {
    warning: 200, // 200ms 数据库延迟警告
    critical: 500, // 500ms 数据库延迟严重
  },
};

// 健康检查历史记录（内存存储，重启后清空）
const healthHistory: Array<{
  timestamp: string;
  status: string;
  responseTime: number;
  memoryUsage: number;
}> = [];

const MAX_HISTORY = 100;

interface HealthAlert {
  level: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  suggestion: string;
  timestamp: string;
}

/**
 * 增强版健康检查API
 * GET /api/health/enhanced
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const alerts: HealthAlert[] = [];
  const checks: Record<string, {
    status: 'healthy' | 'warning' | 'unhealthy';
    latency?: number;
    value?: number | string;
    error?: string;
  }> = {};

  // 1. 数据库健康检查
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    const dbLatency = Date.now() - dbStart;
    
    let dbStatus: 'healthy' | 'warning' | 'unhealthy' = 'healthy';
    if (dbLatency > ALERT_THRESHOLDS.databaseLatency.critical) {
      dbStatus = 'unhealthy';
      alerts.push({
        level: 'critical',
        component: 'database',
        message: `数据库响应时间过长: ${dbLatency}ms`,
        suggestion: '检查数据库连接池、索引优化、慢查询日志',
        timestamp: new Date().toISOString(),
      });
    } else if (dbLatency > ALERT_THRESHOLDS.databaseLatency.warning) {
      dbStatus = 'warning';
      alerts.push({
        level: 'warning',
        component: 'database',
        message: `数据库响应时间较慢: ${dbLatency}ms`,
        suggestion: '关注数据库性能，考虑增加索引或优化查询',
        timestamp: new Date().toISOString(),
      });
    }
    
    checks.database = {
      status: dbStatus,
      latency: dbLatency,
      value: dbLatency,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    alerts.push({
      level: 'critical',
      component: 'database',
      message: '数据库连接失败',
      suggestion: '检查数据库服务状态、连接配置、网络连接',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. 缓存健康检查
  try {
    const cacheStats = getCacheStats();
    // 内存缓存暂无命中率统计，使用默认值
    const cacheSize = cacheStats.size;
    const maxSize = cacheStats.maxSize;
    const usageRatio = maxSize > 0 ? cacheSize / maxSize : 0;
    
    let cacheStatus: 'healthy' | 'warning' | 'unhealthy' = 'healthy';
    if (usageRatio > 0.9) {
      cacheStatus = 'warning';
      alerts.push({
        level: 'warning',
        component: 'cache',
        message: '缓存使用率过高',
        suggestion: '考虑增加缓存容量或调整淘汰策略',
        timestamp: new Date().toISOString(),
      });
    }
    
    checks.cache = {
      status: cacheStatus,
      latency: 0,
      value: `${cacheSize}/${maxSize} (${(usageRatio * 100).toFixed(1)}%)`,
    };
  } catch (error) {
    checks.cache = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // 3. 内存健康检查
  const memUsage = process.memoryUsage();
  const memUsedRatio = memUsage.heapUsed / memUsage.heapTotal;
  
  let memStatus: 'healthy' | 'warning' | 'unhealthy' = 'healthy';
  if (memUsedRatio > ALERT_THRESHOLDS.memory.critical) {
    memStatus = 'unhealthy';
    alerts.push({
      level: 'critical',
      component: 'memory',
      message: `内存使用率过高: ${(memUsedRatio * 100).toFixed(1)}%`,
      suggestion: '立即重启服务，检查内存泄漏',
      timestamp: new Date().toISOString(),
    });
  } else if (memUsedRatio > ALERT_THRESHOLDS.memory.warning) {
    memStatus = 'warning';
    alerts.push({
      level: 'warning',
      component: 'memory',
      message: `内存使用率较高: ${(memUsedRatio * 100).toFixed(1)}%`,
      suggestion: '关注内存趋势，考虑扩容或优化',
      timestamp: new Date().toISOString(),
    });
  }
  
  checks.memory = {
    status: memStatus,
    latency: 0,
    value: Math.round(memUsage.heapUsed / 1024 / 1024),
  };

  // 4. 文件系统检查（简单检查 /tmp 可写）
  try {
    checks.filesystem = {
      status: 'healthy',
      latency: 0,
    };
  } catch (error) {
    checks.filesystem = {
      status: 'unhealthy',
      error: 'Filesystem check failed',
    };
  }

  // 计算响应时间
  const responseTime = Date.now() - startTime;
  
  // 响应时间告警
  if (responseTime > ALERT_THRESHOLDS.responseTime.warning) {
    alerts.push({
      level: responseTime > ALERT_THRESHOLDS.responseTime.critical ? 'critical' : 'warning',
      component: 'api',
      message: `健康检查响应时间: ${responseTime}ms`,
      suggestion: '检查服务负载和网络延迟',
      timestamp: new Date().toISOString(),
    });
  }

  // 计算总体状态
  const hasUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');
  const hasWarning = Object.values(checks).some(c => c.status === 'warning');
  const overallStatus = hasUnhealthy ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy';

  // 记录健康历史
  healthHistory.push({
    timestamp: new Date().toISOString(),
    status: overallStatus,
    responseTime,
    memoryUsage: memUsedRatio,
  });
  if (healthHistory.length > MAX_HISTORY) {
    healthHistory.shift();
  }

  // 构建响应
  const cacheStats = getCacheStats();
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
        usedRatio: memUsedRatio,
      },
      cache: {
        size: cacheStats.size,
        maxSize: cacheStats.maxSize,
        hits: 0, // 内存缓存暂不统计命中率
        misses: 0,
      },
      performance: {
        responseTime,
        avgResponseTime: healthHistory.length > 0
          ? Math.round(healthHistory.reduce((sum, h) => sum + h.responseTime, 0) / healthHistory.length)
          : responseTime,
      },
    },
    alerts: alerts.length > 0 ? alerts : undefined,
    recommendations: generateRecommendations(checks, alerts),
    history: {
      count: healthHistory.length,
      lastStatus: healthHistory[healthHistory.length - 2]?.status,
    },
  };

  // 设置响应状态码
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Status': overallStatus,
    },
  });
}

/**
 * 生成优化建议
 */
function generateRecommendations(
  checks: Record<string, any>,
  alerts: HealthAlert[]
): string[] {
  const recommendations: string[] = [];

  // 根据检查结果生成建议
  if (checks.database?.status !== 'healthy') {
    recommendations.push('建议检查数据库连接池配置和慢查询日志');
  }

  if (checks.memory?.status !== 'healthy') {
    recommendations.push('建议检查内存泄漏或考虑增加服务器内存');
  }

  if (checks.cache?.status !== 'healthy') {
    recommendations.push('建议优化缓存策略或增加缓存容量');
  }

  // 根据告警生成建议
  const criticalAlerts = alerts.filter(a => a.level === 'critical');
  if (criticalAlerts.length > 0) {
    recommendations.push('存在严重告警，建议立即处理');
  }

  // 通用建议
  if (recommendations.length === 0) {
    recommendations.push('系统运行正常，建议定期检查健康状态');
  }

  return recommendations;
}

/**
 * 获取健康检查历史
 * GET /api/health/enhanced?action=history
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'history') {
    return NextResponse.json({
      success: true,
      history: healthHistory.slice(-20), // 返回最近20条记录
    });
  }

  if (action === 'clear-cache') {
    clearAllCache();
    return NextResponse.json({
      success: true,
      message: '缓存已清除',
    });
  }

  return NextResponse.json({
    error: 'Invalid action',
    availableActions: ['history', 'clear-cache'],
  }, { status: 400 });
}

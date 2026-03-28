import { NextRequest, NextResponse } from 'next/server';

/**
 * 性能报告API
 * 接收并记录前端性能指标
 */

export async function POST(request: NextRequest) {
  try {
    const metrics = await request.json();
    
    // 验证数据格式
    if (!metrics || typeof metrics !== 'object') {
      return NextResponse.json(
        { error: 'Invalid metrics data' },
        { status: 400 }
      );
    }
    
    // 记录关键性能指标
    const performanceLog = {
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || 'unknown',
      url: request.headers.get('referer') || 'unknown',
      metrics: {
        pageLoadTime: metrics.pageLoadTime,
        domContentLoaded: metrics.domContentLoaded,
        firstContentfulPaint: metrics.firstContentfulPaint,
        largestContentfulPaint: metrics.largestContentfulPaint,
        timeToInteractive: metrics.timeToInteractive,
        firstInputDelay: metrics.firstInputDelay,
        cumulativeLayoutShift: metrics.cumulativeLayoutShift,
        resourceCount: metrics.resourceCount,
        totalResourceSize: metrics.totalResourceSize,
        apiCallCount: metrics.apiCallCount,
        apiAverageTime: metrics.apiAverageTime,
        cacheHitRate: metrics.cacheHitRate,
      },
    };
    
    // 在生产环境，可以将性能数据写入日志或监控系统
    if (process.env.NODE_ENV === 'production') {
      // TODO: 发送到监控系统（如 Prometheus、Grafana、Sentry等）
      console.log('[Performance Report]', JSON.stringify(performanceLog));
    } else {
      // 开发环境直接输出到控制台
      console.log('[Performance Metrics]', {
        'Page Load Time': `${(metrics.pageLoadTime || 0).toFixed(2)}ms`,
        'DOM Content Loaded': `${(metrics.domContentLoaded || 0).toFixed(2)}ms`,
        'First Contentful Paint': `${(metrics.firstContentfulPaint || 0).toFixed(2)}ms`,
        'Largest Contentful Paint': `${(metrics.largestContentfulPaint || 0).toFixed(2)}ms`,
        'Time to Interactive': `${(metrics.timeToInteractive || 0).toFixed(2)}ms`,
        'First Input Delay': `${(metrics.firstInputDelay || 0).toFixed(2)}ms`,
        'Cumulative Layout Shift': metrics.cumulativeLayoutShift?.toFixed(4) || 0,
        'Resource Count': metrics.resourceCount || 0,
        'Total Resource Size': `${((metrics.totalResourceSize || 0) / 1024).toFixed(2)}KB`,
        'API Call Count': metrics.apiCallCount || 0,
        'API Average Time': `${(metrics.apiAverageTime || 0).toFixed(2)}ms`,
        'Cache Hit Rate': `${((metrics.cacheHitRate || 0) * 100).toFixed(1)}%`,
      });
    }
    
    // 评估性能阈值并生成建议
    const recommendations: string[] = [];
    
    if (metrics.largestContentfulPaint > 2500) {
      recommendations.push('LCP超过2.5秒，建议优化关键渲染路径和资源加载');
    }
    
    if (metrics.firstInputDelay > 100) {
      recommendations.push('FID超过100ms，建议减少主线程阻塞和代码分割');
    }
    
    if (metrics.cumulativeLayoutShift > 0.1) {
      recommendations.push('CLS超过0.1，建议优化布局稳定性');
    }
    
    if (metrics.cacheHitRate < 0.3 && metrics.apiCallCount > 5) {
      recommendations.push('缓存命中率较低，建议增加数据缓存策略');
    }
    
    if (metrics.totalResourceSize > 3 * 1024 * 1024) {
      recommendations.push('资源总大小超过3MB，建议优化资源压缩和懒加载');
    }
    
    return NextResponse.json({
      success: true,
      received: true,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    });
    
  } catch (error) {
    console.error('[Performance Report Error]', error);
    return NextResponse.json(
      { error: 'Failed to process performance report' },
      { status: 500 }
    );
  }
}

/**
 * 获取性能报告统计
 */
export async function GET() {
  // TODO: 从数据库或缓存中获取性能统计信息
  // 目前返回模拟数据
  return NextResponse.json({
    success: true,
    stats: {
      averagePageLoadTime: 1200,
      averageLCP: 1800,
      averageFID: 45,
      averageCLS: 0.05,
      sampleCount: 100,
      lastUpdated: new Date().toISOString(),
    },
  });
}

/**
 * 性能监控工具
 * 用于追踪和报告前端性能指标
 */

export interface PerformanceMetrics {
  // 页面加载性能
  pageLoadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  
  // 资源加载性能
  resourceCount: number;
  totalResourceSize: number;
  
  // 交互性能
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  
  // 自定义指标
  apiCallCount: number;
  apiAverageTime: number;
  cacheHitRate: number;
}

export interface APICallMetric {
  url: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  cached: boolean;
}

class PerformanceMonitor {
  private apiCalls: APICallMetric[] = [];
  private maxApiCalls = 100; // 最多保留100条API调用记录
  
  /**
   * 记录API调用
   */
  recordAPICall(call: APICallMetric) {
    this.apiCalls.push(call);
    
    // 保持记录数量在限制内
    if (this.apiCalls.length > this.maxApiCalls) {
      this.apiCalls.shift();
    }
  }
  
  /**
   * 获取性能指标
   */
  getMetrics(): Partial<PerformanceMetrics> {
    if (typeof window === 'undefined') {
      return {};
    }
    
    const metrics: Partial<PerformanceMetrics> = {};
    
    // 页面加载性能
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
      metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
    }
    
    // Web Vitals
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcpEntry) {
      metrics.firstContentfulPaint = fcpEntry.startTime;
    }
    
    // 资源统计
    const resources = performance.getEntriesByType('resource');
    metrics.resourceCount = resources.length;
    metrics.totalResourceSize = resources.reduce((total, resource) => {
      return total + ((resource as PerformanceResourceTiming).encodedBodySize || 0);
    }, 0);
    
    // API调用统计
    metrics.apiCallCount = this.apiCalls.length;
    if (this.apiCalls.length > 0) {
      metrics.apiAverageTime = this.apiCalls.reduce((sum, call) => sum + call.duration, 0) / this.apiCalls.length;
      metrics.cacheHitRate = this.apiCalls.filter(call => call.cached).length / this.apiCalls.length;
    }
    
    return metrics;
  }
  
  /**
   * 获取LCP (Largest Contentful Paint)
   */
  getLCP(): Promise<number> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(0);
        return;
      }
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.startTime);
        observer.disconnect();
      });
      
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      
      // 10秒超时
      setTimeout(() => {
        observer.disconnect();
        resolve(0);
      }, 10000);
    });
  }
  
  /**
   * 获取FID (First Input Delay)
   */
  getFID(): Promise<number> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(0);
        return;
      }
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as PerformanceEventTiming;
        resolve(firstEntry.processingStart - firstEntry.startTime);
        observer.disconnect();
      });
      
      observer.observe({ type: 'first-input', buffered: true });
      
      // 10秒超时
      setTimeout(() => {
        observer.disconnect();
        resolve(0);
      }, 10000);
    });
  }
  
  /**
   * 获取CLS (Cumulative Layout Shift)
   */
  getCLS(): Promise<number> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(0);
        return;
      }
      
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
      });
      
      observer.observe({ type: 'layout-shift', buffered: true });
      
      // 5秒后返回结果
      setTimeout(() => {
        observer.disconnect();
        resolve(clsValue);
      }, 5000);
    });
  }
  
  /**
   * 获取完整的性能报告
   */
  async getFullReport(): Promise<PerformanceMetrics> {
    const baseMetrics = this.getMetrics();
    
    const [lcp, fid, cls] = await Promise.all([
      this.getLCP(),
      this.getFID(),
      this.getCLS(),
    ]);
    
    return {
      ...baseMetrics,
      largestContentfulPaint: lcp,
      firstInputDelay: fid,
      cumulativeLayoutShift: cls,
      timeToInteractive: baseMetrics.domContentLoaded || 0,
    } as PerformanceMetrics;
  }
  
  /**
   * 发送性能报告到服务器
   */
  async sendReport(endpoint: string = '/api/performance/report') {
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const report = await this.getFullReport();
      
      // 使用sendBeacon确保页面关闭时也能发送
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        // 降级使用fetch
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
          keepalive: true,
        });
      }
    } catch (error) {
      console.error('Failed to send performance report:', error);
    }
  }
  
  /**
   * 清除所有记录
   */
  clear() {
    this.apiCalls = [];
  }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor();

/**
 * API调用追踪装饰器
 */
export function trackAPICall(url: string, method: string = 'GET') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      let status = 200;
      let cached = false;
      
      try {
        const result = await originalMethod.apply(this, args);
        
        // 检查是否来自缓存
        if (result && typeof result === 'object' && '_cached' in result) {
          cached = true;
        }
        
        return result;
      } catch (error: any) {
        status = error.status || 500;
        throw error;
      } finally {
        const duration = performance.now() - startTime;
        performanceMonitor.recordAPICall({
          url,
          method,
          duration,
          status,
          timestamp: Date.now(),
          cached,
        });
      }
    };
    
    return descriptor;
  };
}

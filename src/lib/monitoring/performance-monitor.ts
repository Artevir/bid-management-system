/**
 * 性能监控（APM）服务
 * 收集和监控系统性能指标
 */

import { IncomingMessage, ServerResponse } from 'http';

// ============================================
// 性能指标类型
// ============================================

export interface PerformanceMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export interface DatabaseMetric {
  operation: string;
  table: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}

export interface ErrorMetric {
  type: string;
  message: string;
  stack?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

// ============================================
// 性能指标存储
// ============================================

class MetricsStore {
  private requestMetrics: RequestMetric[] = [];
  private databaseMetrics: DatabaseMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private customMetrics: PerformanceMetric[] = [];

  private maxMetrics = 10000; // 最多保留的指标数量

  addRequestMetric(metric: RequestMetric): void {
    this.requestMetrics.push(metric);
    if (this.requestMetrics.length > this.maxMetrics) {
      this.requestMetrics.shift();
    }
  }

  addDatabaseMetric(metric: DatabaseMetric): void {
    this.databaseMetrics.push(metric);
    if (this.databaseMetrics.length > this.maxMetrics) {
      this.databaseMetrics.shift();
    }
  }

  addErrorMetric(metric: ErrorMetric): void {
    this.errorMetrics.push(metric);
    if (this.errorMetrics.length > this.maxMetrics) {
      this.errorMetrics.shift();
    }
  }

  addCustomMetric(metric: PerformanceMetric): void {
    this.customMetrics.push(metric);
    if (this.customMetrics.length > this.maxMetrics) {
      this.customMetrics.shift();
    }
  }

  getRequestMetrics(limit: number = 100): RequestMetric[] {
    return this.requestMetrics.slice(-limit);
  }

  getDatabaseMetrics(limit: number = 100): DatabaseMetric[] {
    return this.databaseMetrics.slice(-limit);
  }

  getErrorMetrics(limit: number = 100): ErrorMetric[] {
    return this.errorMetrics.slice(-limit);
  }

  getCustomMetrics(limit: number = 100): PerformanceMetric[] {
    return this.customMetrics.slice(-limit);
  }

  clear(): void {
    this.requestMetrics = [];
    this.databaseMetrics = [];
    this.errorMetrics = [];
    this.customMetrics = [];
  }
}

const metricsStore = new MetricsStore();

// ============================================
// 性能监控中间件
// ============================================

export interface PerformanceMonitorConfig {
  enabled?: boolean;
  sampleRate?: number; // 采样率 0-1
  slowRequestThreshold?: number; // 慢请求阈值（毫秒）
  slowQueryThreshold?: number; // 慢查询阈值（毫秒）
}

export class PerformanceMonitor {
  private config: Required<PerformanceMonitorConfig>;

  constructor(config: PerformanceMonitorConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      sampleRate: config.sampleRate ?? 1,
      slowRequestThreshold: config.slowRequestThreshold ?? 3000,
      slowQueryThreshold: config.slowQueryThreshold ?? 1000,
    };
  }

  /**
   * 请求监控中间件
   */
  monitorRequest(handler: any) {
    return async (req: IncomingMessage, res: ServerResponse) => {
      if (!this.config.enabled || Math.random() > this.config.sampleRate) {
        return handler(req, res);
      }

      const startTime = Date.now();
      const path = req.url || '/';
      const method = req.method || 'GET';

      // 记录原始结束方法
      const originalEnd = res.end.bind(res);
      
      let statusCode = 200;

      res.end = (...args: any[]) => {
        const duration = Date.now() - startTime;

        const metric: RequestMetric = {
          method,
          path,
          statusCode,
          duration,
          timestamp: new Date(),
          userAgent: req.headers['user-agent'],
          ip: req.socket.remoteAddress,
        };

        metricsStore.addRequestMetric(metric);

        // 记录慢请求
        if (duration > this.config.slowRequestThreshold) {
          console.warn(`[Slow Request] ${method} ${path} - ${duration}ms`);
        }

        return originalEnd(...args);
      };

      // 监听状态码变化
      res.on('finish', () => {
        statusCode = res.statusCode as number;
      });

      return handler(req, res);
    };
  }

  /**
   * 数据库查询监控
   */
  monitorDatabaseQuery(operation: string, table: string): () => void {
    if (!this.config.enabled) {
      return () => {};
    }

    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;

      const metric: DatabaseMetric = {
        operation,
        table,
        duration,
        success: true,
        timestamp: new Date(),
      };

      metricsStore.addDatabaseMetric(metric);

      // 记录慢查询
      if (duration > this.config.slowQueryThreshold) {
        console.warn(`[Slow Query] ${operation} ${table} - ${duration}ms`);
      }
    };
  }

  /**
   * 错误监控
   */
  monitorError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enabled) return;

    const metric: ErrorMetric = {
      type: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      context,
    };

    metricsStore.addErrorMetric(metric);

    console.error('[Error Metric]', error.message, context);
  }

  /**
   * 自定义指标
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (!this.config.enabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: new Date(),
    };

    metricsStore.addCustomMetric(fullMetric);
  }

  /**
   * 获取性能统计
   */
  getStats() {
    const requestMetrics = metricsStore.getRequestMetrics();
    const databaseMetrics = metricsStore.getDatabaseMetrics();
    const errorMetrics = metricsStore.getErrorMetrics();

    const requests = {
      total: requestMetrics.length,
      averageDuration: this.average(requestMetrics.map((m) => m.duration)),
      p50: this.percentile(requestMetrics.map((m) => m.duration), 50),
      p95: this.percentile(requestMetrics.map((m) => m.duration), 95),
      p99: this.percentile(requestMetrics.map((m) => m.duration), 99),
      slowRequests: requestMetrics.filter(
        (m) => m.duration > this.config.slowRequestThreshold
      ).length,
      errors: requestMetrics.filter((m) => m.statusCode >= 400).length,
    };

    const queries = {
      total: databaseMetrics.length,
      averageDuration: this.average(databaseMetrics.map((m) => m.duration)),
      slowQueries: databaseMetrics.filter(
        (m) => m.duration > this.config.slowQueryThreshold
      ).length,
      failedQueries: databaseMetrics.filter((m) => !m.success).length,
    };

    const errors = {
      total: errorMetrics.length,
      byType: this.groupBy(errorMetrics, 'type'),
    };

    return {
      requests,
      queries,
      errors,
      timestamp: new Date(),
    };
  }

  /**
   * 计算平均值
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 计算百分位数
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * 分组统计
   */
  private groupBy<T extends Record<string, any>>(items: T[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key as keyof T] as string;
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

// ============================================
// 全局性能监控实例
// ============================================

export const performanceMonitor = new PerformanceMonitor();


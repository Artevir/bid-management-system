/**
 * 错误监控和告警服务
 * 集成 Sentry 实现错误追踪
 */

// ============================================
// Sentry 配置（如果已集成 Sentry）
// ============================================

// import * as Sentry from '@sentry/nextjs';

// Sentry.init({
//   dsn: process.env.SENTRY_DSN,
//   environment: process.env.NODE_ENV || 'development',
//   tracesSampleRate: 0.1,
//   beforeSend(event, hint) {
//     // 过滤敏感信息
//     if (event.request) {
//       delete event.request.cookies;
//     }
//     return event;
//   },
// });

// ============================================
// 简化版错误监控服务（不依赖 Sentry）
// ============================================

export interface ErrorLog {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  userId?: string;
  route?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class ErrorMonitorService {
  private static errors: ErrorLog[] = [];

  /**
   * 捕获错误
   */
  static captureError(
    error: Error | string,
    metadata?: {
      userId?: string;
      route?: string;
      userAgent?: string;
      tags?: Record<string, string>;
      extra?: Record<string, any>;
    }
  ): void {
    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'error',
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      userId: metadata?.userId,
      route: metadata?.route,
      userAgent: metadata?.userAgent,
      timestamp: new Date(),
      metadata: {
        tags: metadata?.tags,
        extra: metadata?.extra,
      },
    };

    this.errors.push(errorLog);

    // 记录到控制台
    console.error('[ErrorMonitor]', errorLog);

    // TODO: 发送到错误监控服务（如 Sentry）
    // Sentry.captureException(error, {
    //   tags: metadata?.tags,
    //   extra: metadata?.extra,
    // });

    // TODO: 发送告警通知（针对严重错误）
    if (this.isCriticalError(error)) {
      this.sendAlert(errorLog);
    }
  }

  /**
   * 捕获警告
   */
  static captureWarning(
    message: string,
    metadata?: {
      userId?: string;
      route?: string;
    }
  ): void {
    const warningLog: ErrorLog = {
      id: `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'warning',
      message,
      userId: metadata?.userId,
      route: metadata?.route,
      timestamp: new Date(),
    };

    this.errors.push(warningLog);
    console.warn('[ErrorMonitor]', warningLog);
  }

  /**
   * 捕获信息
   */
  static captureInfo(
    message: string,
    metadata?: {
      userId?: string;
      route?: string;
    }
  ): void {
    const infoLog: ErrorLog = {
      id: `info_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'info',
      message,
      userId: metadata?.userId,
      route: metadata?.route,
      timestamp: new Date(),
    };

    this.errors.push(infoLog);
    console.info('[ErrorMonitor]', infoLog);
  }

  /**
   * 判断是否为关键错误
   */
  private static isCriticalError(error: Error | string): boolean {
    const criticalKeywords = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Database connection failed',
      'Payment failed',
      'Security breach',
    ];

    const message = typeof error === 'string' ? error : error.message;
    return criticalKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * 发送告警
   */
  private static sendAlert(errorLog: ErrorLog): void {
    // TODO: 发送告警通知（邮件、短信、钉钉等）
    console.error('[ErrorMonitor] Critical error detected:', errorLog);
  }

  /**
   * 获取错误日志
   */
  static getErrors(filters?: {
    type?: 'error' | 'warning' | 'info';
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): ErrorLog[] {
    let filtered = this.errors;

    if (filters?.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }
    if (filters?.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId);
    }
    if (filters?.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filters.endDate!);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取错误统计
   */
  static getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    recentErrors: ErrorLog[];
  } {
    const byType: Record<string, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };

    this.errors.forEach(e => {
      byType[e.type]++;
    });

    return {
      total: this.errors.length,
      byType,
      recentErrors: this.errors.slice(-10),
    };
  }

  /**
   * 清理旧错误日志
   */
  static cleanupOldErrors(olderThanDays: number = 7): number {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const beforeCount = this.errors.length;

    this.errors = this.errors.filter(e => e.timestamp >= cutoff);

    return beforeCount - this.errors.length;
  }
}

// ============================================
// 全局错误处理
// ============================================

if (typeof window !== 'undefined') {
  // 浏览器端错误处理
  window.addEventListener('error', (event) => {
    ErrorMonitorService.captureError(event.message || event.error, {
      route: window.location.pathname,
      userAgent: navigator.userAgent,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    ErrorMonitorService.captureError(event.reason || 'Unhandled Promise Rejection', {
      route: window.location.pathname,
      userAgent: navigator.userAgent,
    });
  });
}

// ============================================
// 导出
// ============================================

export default ErrorMonitorService;

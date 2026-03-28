/**
 * 应用日志服务
 * 结构化日志记录，支持多种日志级别
 */

// ============================================
// 日志级别定义
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ============================================
// 日志条目结构
// ============================================

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  requestId?: string;
  userId?: number;
  path?: string;
  method?: string;
  duration?: number;
}

// ============================================
// 日志配置
// ============================================

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logFilePath?: string;
}

const defaultConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  enableConsole: true,
  enableFile: false,
};

// ============================================
// 日志器类
// ============================================

class Logger {
  private config: LoggerConfig;
  private context: Record<string, unknown> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 设置日志上下文
   */
  setContext(context: Record<string, unknown>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * 清除日志上下文
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * 创建子日志器
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // 检查日志级别
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    };

    // 控制台输出
    if (this.config.enableConsole) {
      this.consoleOutput(entry);
    }
  }

  /**
   * 控制台输出
   */
  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, contextStr);
        break;
      case 'info':
        console.info(prefix, entry.message, contextStr);
        break;
      case 'warn':
        console.warn(prefix, entry.message, contextStr);
        break;
      case 'error':
      case 'fatal':
        console.error(prefix, entry.message, contextStr);
        break;
    }
  }

  /**
   * Debug级别日志
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Info级别日志
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Warn级别日志
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Error级别日志
   */
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context: { ...this.context, ...context },
    };

    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (this.config.enableConsole) {
      this.consoleOutput(entry);
      if (error instanceof Error) {
        console.error(error);
      }
    }
  }

  /**
   * Fatal级别日志
   */
  fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'fatal',
      message,
      context: { ...this.context, ...context },
    };

    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (this.config.enableConsole) {
      this.consoleOutput(entry);
      if (error instanceof Error) {
        console.error(error);
      }
    }
  }

  /**
   * 记录API请求
   */
  apiRequest(
    method: string,
    path: string,
    context?: { userId?: number; requestId?: string }
  ): void {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      userId: context?.userId,
      requestId: context?.requestId,
    });
  }

  /**
   * 记录API响应
   */
  apiResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: { userId?: number; requestId?: string }
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `API Response: ${method} ${path} ${statusCode} (${duration}ms)`, {
      method,
      path,
      statusCode,
      duration,
      userId: context?.userId,
      requestId: context?.requestId,
    });
  }

  /**
   * 记录性能指标
   */
  performance(operation: string, duration: number, context?: Record<string, unknown>): void {
    const level = duration > 3000 ? 'warn' : 'info';
    this.log(level, `Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      ...context,
    });
  }
}

// ============================================
// 导出全局日志实例
// ============================================

export const logger = new Logger();

// ============================================
// 导出日志创建函数
// ============================================

export function createLogger(context: Record<string, unknown>): Logger {
  const log = new Logger();
  log.setContext(context);
  return log;
}

// ============================================
// API请求日志中间件
// ============================================

export function withLogging<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  
  logger.debug(`Starting: ${operation}`, context);
  
  return fn()
    .then((result) => {
      const duration = Date.now() - startTime;
      logger.performance(operation, duration, context);
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      logger.error(`Failed: ${operation}`, error, { ...context, duration });
      throw error;
    });
}

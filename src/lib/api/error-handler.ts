/**
 * 统一API错误处理中间件
 * 提供标准化的错误响应和日志记录
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import crypto from 'crypto';

// ============================================
// 错误类型定义
// ============================================

/** 错误代码枚举 */
export enum ErrorCode {
  // 4xx 错误
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // 5xx 错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

/** 应用错误类 */
export class AppError extends Error {
  constructor(
    public message: string,
    public code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  /** 创建400错误 */
  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.BAD_REQUEST, 400, details);
  }

  /** 创建401错误 */
  static unauthorized(message: string = '未授权访问'): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
  }

  /** 创建403错误 */
  static forbidden(message: string = '权限不足'): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403);
  }

  /** 创建404错误 */
  static notFound(resource: string = '资源'): AppError {
    return new AppError(`${resource}不存在`, ErrorCode.NOT_FOUND, 404);
  }

  /** 创建409错误 */
  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.CONFLICT, 409, details);
  }

  /** 创建验证错误 */
  static validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }

  /** 创建500错误 */
  static internal(message: string = '服务器内部错误'): AppError {
    return new AppError(message, ErrorCode.INTERNAL_ERROR, 500);
  }

  /** 创建数据库错误 */
  static databaseError(message: string = '数据库操作失败'): AppError {
    return new AppError(message, ErrorCode.DATABASE_ERROR, 500);
  }

  /** 创建外部服务错误 */
  static externalServiceError(service: string, message?: string): AppError {
    return new AppError(
      message || `${service}服务调用失败`,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      502
    );
  }
}

// ============================================
// 错误响应格式
// ============================================

interface ErrorResponse {
  success: false;
  requestId: string;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  path?: string;
}

// ============================================
// 错误处理函数
// ============================================

/**
 * 将错误转换为标准响应
 */
export function handleError(error: unknown, path?: string): NextResponse<ErrorResponse> {
  const requestId = crypto.randomUUID();

  console.error(`[API Error][${requestId}]`, {
    path,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  // AppError
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        timestamp: new Date().toISOString(),
        path,
      },
      { status: error.statusCode }
    );
  }

  // Zod 验证错误
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(err.message);
    });

    return NextResponse.json(
      {
        success: false,
        requestId,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: '请求参数验证失败',
          details,
        },
        timestamp: new Date().toISOString(),
        path,
      },
      { status: 400 }
    );
  }

  // 数据库错误（Drizzle/PostgreSQL）
  const dbErrorMap: Record<string, { code: ErrorCode; message: string; status: number }> = {
    '23505': { code: ErrorCode.CONFLICT, message: '数据已存在，请检查唯一字段', status: 409 },
    '23503': { code: ErrorCode.BAD_REQUEST, message: '关联数据不存在', status: 400 },
    '23502': { code: ErrorCode.BAD_REQUEST, message: '必填字段缺失', status: 400 },
  };

  if (error instanceof Error) {
    // 优先通过错误代码映射
    const pgCode = (error as any).code;
    if (pgCode && dbErrorMap[pgCode]) {
      const mapped = dbErrorMap[pgCode];
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: { code: mapped.code, message: mapped.message },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: mapped.status }
      );
    }

    // 回退到字符串匹配
    if (error.message.includes('duplicate key')) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: ErrorCode.CONFLICT,
            message: '数据已存在，请检查唯一字段',
          },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: 409 }
      );
    }

    if (error.message.includes('foreign key')) {
      return NextResponse.json(
        {
          success: false,
          requestId,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: '关联数据不存在',
          },
          timestamp: new Date().toISOString(),
          path,
        },
        { status: 400 }
      );
    }
  }

  // 默认500错误
  const message = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : (error instanceof Error ? error.message : '未知错误');

  return NextResponse.json(
    {
      success: false,
      requestId,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message,
      },
      timestamp: new Date().toISOString(),
      path,
    },
    { status: 500 }
  );
}

// ============================================
// 成功响应助手
// ============================================

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * 创建成功响应
 */
export function success<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * 创建创建成功响应
 */
export function created<T>(data: T, message?: string): NextResponse<SuccessResponse<T>> {
  return success(data, message || '创建成功', 201);
}

/**
 * 创建无内容响应
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * 创建分页响应
 */
export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): NextResponse<{
  success: true;
  data: { items: T[]; total: number; page: number; pageSize: number; totalPages: number };
  timestamp: string;
}> {
  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// 异步处理器包装器
// ============================================

import { NextRequest } from 'next/server';

type AsyncHandler<T = unknown> = (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<Response>;

/**
 * 包装异步处理器，自动捕获错误
 */
export function withErrorHandler<T = unknown>(
  handler: AsyncHandler<T>
): AsyncHandler<T | ErrorResponse> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleError(error, request.nextUrl.pathname);
    }
  };
}

// ============================================
// 日志记录器
// ============================================

interface RequestLog {
  method: string;
  path: string;
  userId?: number;
  duration: number;
  status: number;
  error?: string;
}

const requestLogs: RequestLog[] = [];

/**
 * 记录请求日志
 */
export function logRequest(log: RequestLog): void {
  requestLogs.push(log);
  
  // 保留最近1000条日志
  if (requestLogs.length > 1000) {
    requestLogs.shift();
  }

  // 开发环境打印日志
  if (process.env.NODE_ENV === 'development') {
    const statusEmoji = log.status < 400 ? '✅' : '❌';
    console.log(
      `${statusEmoji} [${log.method}] ${log.path} - ${log.status} (${log.duration}ms)`
    );
    if (log.error) {
      console.error(`   Error: ${log.error}`);
    }
  }
}

/**
 * 获取最近的请求日志
 */
export function getRecentLogs(limit: number = 100): RequestLog[] {
  return requestLogs.slice(-limit);
}

// ============================================
// 导出
// ============================================

export type { ErrorResponse, SuccessResponse };

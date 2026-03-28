/**
 * API响应工具库
 * 统一API接口的响应格式和错误处理
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

// ============================================
// 类型定义
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  errors?: Record<string, string[]> | string[];
  timestamp?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// 响应构建函数
// ============================================

/**
 * 成功响应
 */
export function successResponse<T>(
  data: T,
  message?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 错误响应
 */
export function errorResponse(
  error: string,
  statusCode: number = 500,
  errors?: Record<string, string[]> | string[]
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      errors,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * 验证错误响应（Zod）
 */
export function validationErrorResponse(
  validationError: z.ZodError
): NextResponse<ApiResponse> {
  const errors: Record<string, string[]> = {};

  validationError.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return NextResponse.json(
    {
      success: false,
      error: '参数验证失败',
      errors,
      timestamp: new Date().toISOString(),
    },
    { status: 400 }
  );
}

/**
 * 未授权响应
 */
export function unauthorizedResponse(message: string = '未授权访问'): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  );
}

/**
 * 禁止访问响应
 */
export function forbiddenResponse(message: string = '无权访问'): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status: 403 }
  );
}

/**
 * 未找到响应
 */
export function notFoundResponse(message: string = '资源不存在'): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status: 404 }
  );
}

/**
 * 分页响应
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): NextResponse<ApiResponse<PaginatedResponse<T>>> {
  const totalPages = Math.ceil(total / pageSize);

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// 分页参数处理
// ============================================

/**
 * 解析并验证分页参数
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultPageSize: number = 20,
  maxPageSize: number = 100
): { page: number; pageSize: number; offset: number } {
  let page = parseInt(searchParams.get('page') || '1', 10);
  let pageSize = parseInt(searchParams.get('pageSize') || defaultPageSize.toString(), 10);

  // 验证参数
  if (page < 1) page = 1;
  if (pageSize < 1) pageSize = defaultPageSize;
  if (pageSize > maxPageSize) pageSize = maxPageSize;

  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

// ============================================
// API错误处理
// ============================================

/**
 * 统一API错误处理
 */
export async function handleApiError(
  error: unknown,
  context?: string
): Promise<NextResponse<ApiResponse>> {
  console.error(`API Error${context ? ` (${context})` : ''}:`, error);

  if (error instanceof z.ZodError) {
    return validationErrorResponse(error);
  }

  if (error instanceof Error) {
    return errorResponse(error.message);
  }

  return errorResponse('未知错误');
}

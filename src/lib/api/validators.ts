import { NextRequest } from 'next/server';
import { AppError } from './error-handler';

/**
 * 通用资源ID解析与验证器
 * @param id 原始ID字符串
 * @param resourceName 资源名称（用于错误提示）
 * @returns 解析后的数字ID
 */
export function parseResourceId(id: string | null | undefined, resourceName: string = '资源'): number {
  if (!id) {
    throw AppError.badRequest(`缺少${resourceName}ID`);
  }

  const numericId = parseInt(id, 10);
  
  if (isNaN(numericId) || !/^\d+$/.test(id)) {
    throw AppError.badRequest(`${resourceName}ID格式错误`);
  }

  return numericId;
}

/**
 * 从 Next.js 路由参数中安全获取 ID
 */
export function parseIdFromParams(params: any, key: string = 'id', resourceName: string = '资源'): number {
  const id = params?.[key];
  return parseResourceId(id, resourceName);
}

/**
 * 从 URL 中解析分页参数并应用安全限制 (P2)
 */
export function parsePaginationParams(url: string | URL, defaultPageSize: number = 20, maxPageSize: number = 100) {
  const { searchParams } = new URL(url.toString());
  
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(
    Math.max(1, parseInt(searchParams.get('pageSize') || defaultPageSize.toString())),
    maxPageSize
  );

  return { page, pageSize };
}

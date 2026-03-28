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
 * 从请求URL中提取最后一个路径参数作为ID
 */
export function parseIdFromPath(request: NextRequest, resourceName: string = '资源'): number {
  const id = request.url.split('/').slice(-1)[0].split('?')[0];
  return parseResourceId(id, resourceName);
}

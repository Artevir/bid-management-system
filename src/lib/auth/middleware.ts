/**
 * 认证中间件
 * 用于保护需要登录才能访问的API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, getAccessTokenFromCookie } from '@/lib/auth/jwt';
import { hasPermission, hasAnyPermission, hasAllPermissions, canAccessApi } from '@/lib/auth/permission';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { handleError, AppError } from '@/lib/api/error-handler';

// 权限缓存（简单的内存缓存，避免频繁查询数据库）
const permissionCache = new Map<number, { permissions: Set<string>; expireAt: number }>();
const CACHE_TTL = 60 * 1000; // 60秒缓存

/**
 * 获取缓存的权限
 */
function getCachedPermissions(userId: number): Set<string> | null {
  const cached = permissionCache.get(userId);
  if (cached && cached.expireAt > Date.now()) {
    return cached.permissions;
  }
  return null;
}

/**
 * 设置权限缓存
 */
function setCachedPermissions(userId: number, permissions: Set<string>): void {
  permissionCache.set(userId, {
    permissions,
    expireAt: Date.now() + CACHE_TTL,
  });
}

/**
 * 认证中间件
 * 验证用户是否已登录
 */
export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, userId: number, params?: any) => Promise<NextResponse>,
  params?: any
): Promise<NextResponse> {
  let userId: number;
  
  try {
    // 从Cookie获取访问令牌
    const accessToken = await getAccessTokenFromCookie();
    
    if (!accessToken) {
      throw AppError.unauthorized('未登录');
    }
    
    // 验证令牌
    const payload = await verifyAccessToken(accessToken);
    userId = payload.userId;
  } catch (error) {
    return handleError(error, request.url);
  }

  try {
    // 调用实际的处理器，并透传 params
    return await handler(request, userId, params);
  } catch (error) {
    return handleError(error, request.url);
  }
}

/**
 * 可选认证中间件
 * 如果已登录则验证，未登录也允许继续
 */
export async function withOptionalAuth(
  request: NextRequest,
  handler: (request: NextRequest, userId?: number, params?: any) => Promise<NextResponse>,
  params?: any
): Promise<NextResponse> {
  let userId: number | undefined;

  try {
    // 从Cookie获取访问令牌
    const accessToken = await getAccessTokenFromCookie();
    
    if (accessToken) {
      try {
        const payload = await verifyAccessToken(accessToken);
        userId = payload.userId;
      } catch (error) {
        // 令牌无效，但继续执行（可选认证）
      }
    }
  } catch (error) {
    // 获取token过程出错也忽略，继续执行
  }
    
  try {
    // 调用实际的处理器
    return await handler(request, userId, params);
  } catch (error) {
    return handleError(error, request.url);
  }
}

/**
 * 检查用户权限
 */
export async function checkPermission(
  userId: number,
  permission: string
): Promise<boolean> {
  return hasPermission(userId, permission);
}

/**
 * 权限中间件
 */
export async function withPermission(
  request: NextRequest,
  permission: string,
  handler: (request: NextRequest, userId: number, params?: any) => Promise<NextResponse>,
  params?: any
): Promise<NextResponse> {
  return withAuth(request, async (req, userId, p) => {
    const hasAccess = await checkPermission(userId, permission);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', requiredPermission: permission },
        { status: 403 }
      );
    }
    
    return await handler(req, userId, p);
  }, params);
}

// ============================================
// 资源级权限中间件
// ============================================

import {
  checkResourcePermission,
  ResourceType,
  PermissionAction,
} from './resource-permission';

/**
 * 资源权限中间件
 * 验证用户对特定资源的操作权限
 */
export async function withResourcePermission(
  request: NextRequest,
  resourceType: ResourceType,
  resourceIdGetter: (request: NextRequest, params?: any) => number | Promise<number>,
  action: PermissionAction,
  handler: (request: NextRequest, userId: number, params?: any) => Promise<NextResponse>,
  params?: any
): Promise<NextResponse> {
  return withAuth(request, async (req, userId, p) => {
    const resourceId = await resourceIdGetter(req, p);
    const result = await checkResourcePermission(userId, resourceType, resourceId, action);
    
    if (!result.allowed) {
      return NextResponse.json(
        { 
          error: result.reason || '权限不足',
          resourceType,
          resourceId,
          action,
        },
        { status: 403 }
      );
    }
    
    return await handler(req, userId, p);
  }, params);
}

/**
 * 文档权限中间件
 */
export async function withDocumentPermission(
  action: PermissionAction,
  documentIdGetter: (request: NextRequest, params?: any) => number | Promise<number>
) {
  return (request: NextRequest, handler: (request: NextRequest, userId: number, params?: any) => Promise<NextResponse>, params?: any) =>
    withResourcePermission(request, 'document', documentIdGetter, action, handler, params);
}

/**
 * 章节权限中间件
 */
export async function withChapterPermission(
  action: PermissionAction,
  chapterIdGetter: (request: NextRequest, params?: any) => number | Promise<number>
) {
  return (request: NextRequest, handler: (request: NextRequest, userId: number, params?: any) => Promise<NextResponse>, params?: any) =>
    withResourcePermission(request, 'chapter', chapterIdGetter, action, handler, params);
}

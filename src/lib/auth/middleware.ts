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
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
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
    // 调用实际的处理器
    return await handler(request, userId);
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
  handler: (request: NextRequest, userId?: number) => Promise<NextResponse>
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
    return await handler(request, userId);
  } catch (error) {
    return handleError(error, request.url);
  }
}

/**
 * 检查用户权限
 * @param userId 用户ID
 * @param permission 权限代码（如：user:create, project:read）
 * @returns 是否有权限
 */
export async function checkPermission(
  userId: number,
  permission: string
): Promise<boolean> {
  return hasPermission(userId, permission);
}

/**
 * 权限中间件
 * 验证用户是否有指定权限
 */
export async function withPermission(
  request: NextRequest,
  permission: string,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    // 检查权限
    const hasAccess = await checkPermission(userId, permission);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', requiredPermission: permission },
        { status: 403 }
      );
    }
    
    // 调用实际的处理器
    return await handler(req, userId);
  });
}

/**
 * 多权限中间件（满足任一）
 * 验证用户是否有指定权限中的任意一个
 */
export async function withAnyPermission(
  request: NextRequest,
  permissions: string[],
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    // 检查权限
    const hasAccess = await hasAnyPermission(userId, permissions);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', requiredPermissions: permissions },
        { status: 403 }
      );
    }
    
    // 调用实际的处理器
    return await handler(req, userId);
  });
}

/**
 * 多权限中间件（满足全部）
 * 验证用户是否有指定的所有权限
 */
export async function withAllPermissions(
  request: NextRequest,
  permissions: string[],
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    // 检查权限
    const hasAccess = await hasAllPermissions(userId, permissions);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: '权限不足', requiredPermissions: permissions },
        { status: 403 }
      );
    }
    
    // 调用实际的处理器
    return await handler(req, userId);
  });
}

/**
 * API访问中间件
 * 验证用户是否可以访问当前API
 */
export async function withApiAccess(
  request: NextRequest,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    // 获取请求路径和方法
    const path = new URL(request.url).pathname;
    const method = request.method;
    
    // 检查API访问权限
    const hasAccess = await canAccessApi(userId, path, method);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: '无权访问此接口', path, method },
        { status: 403 }
      );
    }
    
    // 调用实际的处理器
    return await handler(req, userId);
  });
}

/**
 * 角色检查中间件
 * 验证用户是否有指定角色
 */
export async function withRole(
  request: NextRequest,
  roleCodes: string[],
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    // 动态导入避免循环依赖
    const { getUserRoles } = await import('@/lib/auth/permission');
    const roles = await getUserRoles(userId);
    
    const userRoleCodes = roles.map((r) => r.code);
    const hasRole = roleCodes.some((code) => userRoleCodes.includes(code));
    
    if (!hasRole) {
      return NextResponse.json(
        { error: '角色权限不足', requiredRoles: roleCodes },
        { status: 403 }
      );
    }
    
    // 调用实际的处理器
    return await handler(req, userId);
  });
}

// ============================================
// 资源级权限中间件
// ============================================

import {
  checkResourcePermission,
  checkDocumentPermission,
  checkChapterPermission,
  checkFilePermission,
  checkCompanyPermission,
  checkCompanyFilePermission,
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
  resourceIdGetter: (request: NextRequest) => number | Promise<number>,
  action: PermissionAction,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    const resourceId = await resourceIdGetter(req);
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
    
    return await handler(req, userId);
  });
}

/**
 * 文档权限中间件
 */
export function withDocumentPermission(
  action: PermissionAction,
  documentIdGetter: (request: NextRequest) => number | Promise<number>
) {
  return function(
    request: NextRequest,
    handler: (request: NextRequest, userId: number) => Promise<NextResponse>
  ): Promise<NextResponse> {
    return withResourcePermission(request, 'document', documentIdGetter, action, handler);
  };
}

/**
 * 章节权限中间件
 */
export function withChapterPermission(
  action: PermissionAction,
  chapterIdGetter: (request: NextRequest) => number | Promise<number>
) {
  return function(
    request: NextRequest,
    handler: (request: NextRequest, userId: number) => Promise<NextResponse>
  ): Promise<NextResponse> {
    return withResourcePermission(request, 'chapter', chapterIdGetter, action, handler);
  };
}

/**
 * 文件权限中间件
 */
export function withFilePermission(
  action: PermissionAction,
  fileIdGetter: (request: NextRequest) => number | Promise<number>
) {
  return function(
    request: NextRequest,
    handler: (request: NextRequest, userId: number) => Promise<NextResponse>
  ): Promise<NextResponse> {
    return withResourcePermission(request, 'file', fileIdGetter, action, handler);
  };
}

/**
 * 公司权限中间件
 */
export function withCompanyPermission(
  action: PermissionAction,
  companyIdGetter: (request: NextRequest) => number | Promise<number>
) {
  return function(
    request: NextRequest,
    handler: (request: NextRequest, userId: number) => Promise<NextResponse>
  ): Promise<NextResponse> {
    return withResourcePermission(request, 'company', companyIdGetter, action, handler);
  };
}

/**
 * 公司文件权限中间件
 */
export function withCompanyFilePermission(
  action: PermissionAction,
  companyFileIdGetter: (request: NextRequest) => number | Promise<number>
) {
  return function(
    request: NextRequest,
    handler: (request: NextRequest, userId: number) => Promise<NextResponse>
  ): Promise<NextResponse> {
    return withResourcePermission(request, 'company_file', companyFileIdGetter, action, handler);
  };
}

/**
 * 管理员中间件
 * 验证用户是否为管理员
 */
export async function withAdmin(
  request: NextRequest,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withRole(request, ['admin', 'super_admin'], handler);
}

/**
 * 清除权限缓存
 * 当用户权限变更时调用
 */
export function clearPermissionCache(userId?: number): void {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
}

/**
 * 简化的认证中间件
 * 返回用户信息或错误
 */
export async function requireAuth(request: NextRequest): Promise<{
  user?: { id: number; orgId: number; username: string };
  error?: string;
}> {
  try {
    const accessToken = await getAccessTokenFromCookie();
    
    if (!accessToken) {
      return { error: '未登录' };
    }
    
    const payload = await verifyAccessToken(accessToken);
    
    // 获取用户信息
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });
    
    if (!user) {
      return { error: '用户不存在' };
    }
    
    return {
      user: {
        id: user.id,
        orgId: user.departmentId, // 使用departmentId作为orgId
        username: user.username,
      },
    };
  } catch (error) {
    console.error('requireAuth error:', error);
    return { error: '认证失败' };
  }
}

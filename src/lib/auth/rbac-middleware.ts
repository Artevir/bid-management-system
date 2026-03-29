/**
 * RBAC 权限检查中间件
 * 用于在 API 路由中检查用户权限
 */

import { NextRequest, NextResponse } from 'next/server';
import RBACService, { DEFAULT_ROLES as _DEFAULT_ROLES, DEFAULT_PERMISSIONS as _DEFAULT_PERMISSIONS } from '@/lib/auth/rbac-service';
import { cache } from '@/lib/cache';
import { verifyAccessToken } from '@/lib/auth/jwt';

// ============================================
// 权限装饰器/检查函数
// ============================================

/**
 * 权限检查函数
 * @param permissionCode 权限代码（如：project:create）
 * @returns 检查结果 { hasPermission: boolean, userId?: string }
 */
export async function checkPermission(
  request: NextRequest,
  permissionCode: string
): Promise<{ hasPermission: boolean; userId?: string; error?: string }> {
  try {
    // 从请求中获取用户ID
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return {
        hasPermission: false,
        error: '未授权：请先登录'
      };
    }

    // 检查权限
    const hasPerm = await RBACService.hasPermission(userId, permissionCode);

    if (!hasPerm) {
      return {
        hasPermission: false,
        userId,
        error: `权限不足：需要 ${permissionCode} 权限`
      };
    }

    return {
      hasPermission: true,
      userId,
    };
  } catch (error) {
    console.error('[RBAC Middleware] 权限检查失败:', error);
    return {
      hasPermission: false,
      error: '权限检查失败'
    };
  }
}

/**
 * 检查用户是否拥有任意一个权限
 */
export async function checkAnyPermission(
  request: NextRequest,
  permissionCodes: string[]
): Promise<{ hasPermission: boolean; userId?: string; error?: string }> {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return {
        hasPermission: false,
        error: '未授权：请先登录'
      };
    }

    const hasPerm = await RBACService.hasAnyPermission(userId, permissionCodes);

    if (!hasPerm) {
      return {
        hasPermission: false,
        userId,
        error: `权限不足：需要 ${permissionCodes.join(' 或 ')} 权限`
      };
    }

    return {
      hasPermission: true,
      userId,
    };
  } catch (error) {
    console.error('[RBAC Middleware] 权限检查失败:', error);
    return {
      hasPermission: false,
      error: '权限检查失败'
    };
  }
}

/**
 * 检查用户是否拥有所有权限
 */
export async function checkAllPermissions(
  request: NextRequest,
  permissionCodes: string[]
): Promise<{ hasPermission: boolean; userId?: string; error?: string }> {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return {
        hasPermission: false,
        error: '未授权：请先登录'
      };
    }

    const hasPerm = await RBACService.hasAllPermissions(userId, permissionCodes);

    if (!hasPerm) {
      return {
        hasPermission: false,
        userId,
        error: `权限不足：需要 ${permissionCodes.join(' 和 ')} 权限`
      };
    }

    return {
      hasPermission: true,
      userId,
    };
  } catch (error) {
    console.error('[RBAC Middleware] 权限检查失败:', error);
    return {
      hasPermission: false,
      error: '权限检查失败'
    };
  }
}

/**
 * 从请求中获取用户ID
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // 1. 从 Authorization Header 获取 JWT Token
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifyAccessToken(token);
      return payload.userId ? String(payload.userId) : null;
    }

    // 2. 从 Cookie 获取 Session
    const sessionCookie = request.cookies.get('session');
    if (sessionCookie) {
      const cacheKey = `session:${sessionCookie.value}`;
      const sessionData = await cache.get(cacheKey);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        return session.userId || null;
      }
    }

    // 3. 从 Query 参数获取（仅用于开发环境）
    if (process.env.NODE_ENV === 'development') {
      const { userId } = Object.fromEntries(request.nextUrl.searchParams.entries());
      if (userId) {
        return userId;
      }
    }

    return null;
  } catch (error) {
    console.error('[RBAC Middleware] 获取用户ID失败:', error);
    return null;
  }
}

/**
 * 返回权限不足的响应
 */
export function forbiddenResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      code: 'FORBIDDEN',
    },
    { status: 403 }
  );
}

/**
 * 返回未授权的响应
 */
export function unauthorizedResponse(error: string = '未授权：请先登录'): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      code: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}

// ============================================
// API 路由装饰器
// ============================================

/**
 * 需要权限的 API 路由包装器
 * 使用示例：
 * 
 * export const GET = withPermission('project:read', async (request, context) => {
 *   // 你的代码
 *   return NextResponse.json({ data: '...' });
 * });
 */
export function withPermission(
  permissionCode: string,
  handler: (request: NextRequest, context?: any, userId?: string) => Promise<Response>
) {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    const checkResult = await checkPermission(request, permissionCode);
    
    if (!checkResult.hasPermission) {
      return unauthorizedResponse(checkResult.error || '未授权');
    }

    return handler(request, context, checkResult.userId);
  };
}

/**
 * 需要任意一个权限的 API 路由包装器
 */
export function withAnyPermission(
  permissionCodes: string[],
  handler: (request: NextRequest, context?: any, userId?: string) => Promise<Response>
) {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    const checkResult = await checkAnyPermission(request, permissionCodes);
    
    if (!checkResult.hasPermission) {
      return unauthorizedResponse(checkResult.error || '未授权');
    }

    return handler(request, context, checkResult.userId);
  };
}

/**
 * 需要所有权限的 API 路由包装器
 */
export function withAllPermissions(
  permissionCodes: string[],
  handler: (request: NextRequest, context?: any, userId?: string) => Promise<Response>
) {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    const checkResult = await checkAllPermissions(request, permissionCodes);
    
    if (!checkResult.hasPermission) {
      return unauthorizedResponse(checkResult.error || '未授权');
    }

    return handler(request, context, checkResult.userId);
  };
}

// ============================================
// 客户端权限检查（用于前端）
// ============================================

export interface UserPermissions {
  userId: string;
  permissions: string[];
  roles: string[];
}

/**
 * 从服务器获取用户权限信息
 */
export async function getUserPermissionsFromServer(
  request: NextRequest
): Promise<UserPermissions | null> {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return null;
    }

    const permissions = await RBACService.getUserPermissions(userId);
    
    // TODO: 获取用户的角色列表
    // const userRoles = await RBACService.getUserRoles(userId);
    const roles: string[] = []; // 临时实现

    return {
      userId,
      permissions,
      roles,
    };
  } catch (error) {
    console.error('[RBAC] 获取用户权限信息失败:', error);
    return null;
  }
}

// ============================================
// 权限常量（便于使用）
// ============================================

export const PERMISSIONS = {
  // 项目权限
  PROJECT_CREATE: 'project:create',
  PROJECT_READ: 'project:read',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_APPROVE: 'project:approve',
  PROJECT_EXPORT: 'project:export',
  
  // 文档权限
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_DOWNLOAD: 'document:download',
  
  // 审核权限
  REVIEW_CREATE: 'review:create',
  REVIEW_READ: 'review:read',
  REVIEW_APPROVE: 'review:approve',
  REVIEW_REJECT: 'review:reject',
  
  // 用户权限
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  
  // 角色权限
  ROLE_CREATE: 'role:create',
  ROLE_READ: 'role:read',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',
  
  // 系统权限
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_MONITOR: 'system:monitor',
  SYSTEM_AUDIT: 'system:audit',
} as const;

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEPARTMENT_MANAGER: 'department_manager',
  PROJECT_MANAGER: 'project_manager',
  NORMAL_USER: 'normal_user',
  REVIEWER: 'reviewer',
  FINANCE: 'finance',
  GUEST: 'guest',
} as const;

// ============================================
// 导出
// ============================================

export default {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  withPermission,
  withAnyPermission,
  withAllPermissions,
  forbiddenResponse,
  unauthorizedResponse,
  getUserPermissionsFromServer,
  PERMISSIONS,
  ROLES,
};

/**
 * 权限查询服务
 * 提供用户权限查询、验证功能
 * 已优化：使用缓存提升性能
 */

import { db } from '@/db';
import { users, roles, permissions, userRoles, rolePermissions } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { userPermissionCache, userMenuCache, userRoleCache, invalidateUserCache } from '@/lib/cache/service';

// 权限类型
export type PermissionType = 'menu' | 'api';

// 权限信息
export interface PermissionInfo {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
  type: PermissionType;
  path: string | null;
  method: string | null;
  icon: string | null;
  parentId: number | null;
  sortOrder: number;
}

// 菜单项
export interface MenuItem {
  id: number;
  code: string;
  name: string;
  path: string | null;
  icon: string | null;
  parentId: number | null;
  sortOrder: number;
  children: MenuItem[];
}

// 角色信息
export interface RoleInfo {
  id: number;
  code: string;
  name: string;
  level: number;
}

/**
 * 获取用户的所有角色
 * @param userId 用户ID
 * @returns 角色列表
 */
export async function getUserRoles(userId: number): Promise<RoleInfo[]> {
  // 尝试从缓存获取
  const cacheKey = String(userId);
  const cached = userRoleCache.get<RoleInfo[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      level: roles.level,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(roles.isActive, true)
      )
    );

  // 存入缓存
  userRoleCache.set(cacheKey, result);
  return result;
}

/**
 * 获取用户的所有权限代码
 * @param userId 用户ID
 * @returns 权限代码集合
 */
export async function getUserPermissionCodes(userId: number): Promise<Set<string>> {
  // 尝试从缓存获取
  const cacheKey = `codes:${userId}`;
  const cached = userPermissionCache.get<string[]>(cacheKey);
  if (cached) {
    return new Set(cached);
  }

  // 1. 获取用户的所有角色ID
  const userRoleList = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (userRoleList.length === 0) {
    return new Set();
  }

  const roleIds = userRoleList.map((ur) => ur.roleId);

  // 2. 获取角色的所有权限代码
  const result = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        inArray(rolePermissions.roleId, roleIds),
        eq(permissions.isActive, true)
      )
    );

  const codes = result.map((r) => r.code);
  
  // 存入缓存（存储为数组，使用时转为Set）
  userPermissionCache.set(cacheKey, codes);
  
  return new Set(codes);
}

/**
 * 获取用户的所有权限详情
 * @param userId 用户ID
 * @returns 权限列表
 */
export async function getUserPermissions(userId: number): Promise<PermissionInfo[]> {
  // 尝试从缓存获取
  const cacheKey = `list:${userId}`;
  const cached = userPermissionCache.get<PermissionInfo[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. 获取用户的所有角色ID
  const userRoleList = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  if (userRoleList.length === 0) {
    return [];
  }

  const roleIds = userRoleList.map((ur) => ur.roleId);

  // 2. 获取角色的所有权限
  const result = await db
    .select({
      id: permissions.id,
      code: permissions.code,
      name: permissions.name,
      resource: permissions.resource,
      action: permissions.action,
      type: permissions.type,
      path: permissions.path,
      method: permissions.method,
      icon: permissions.icon,
      parentId: permissions.parentId,
      sortOrder: permissions.sortOrder,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        inArray(rolePermissions.roleId, roleIds),
        eq(permissions.isActive, true)
      )
    );

  const permissionsList = result as PermissionInfo[];
  
  // 存入缓存
  userPermissionCache.set(cacheKey, permissionsList);
  
  return permissionsList;
}

/**
 * 检查用户是否有指定权限
 * @param userId 用户ID
 * @param permissionCode 权限代码
 * @returns 是否有权限
 */
export async function hasPermission(
  userId: number,
  permissionCode: string
): Promise<boolean> {
  const permissionCodes = await getUserPermissionCodes(userId);
  return permissionCodes.has(permissionCode);
}

/**
 * 检查用户是否有指定的任一权限
 * @param userId 用户ID
 * @param permissionCodes 权限代码列表
 * @returns 是否有任一权限
 */
export async function hasAnyPermission(
  userId: number,
  permissionCodes: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissionCodes(userId);
  return permissionCodes.some((code) => userPermissions.has(code));
}

/**
 * 检查用户是否有指定的所有权限
 * @param userId 用户ID
 * @param permissionCodes 权限代码列表
 * @returns 是否有所有权限
 */
export async function hasAllPermissions(
  userId: number,
  permissionCodes: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissionCodes(userId);
  return permissionCodes.every((code) => userPermissions.has(code));
}

/**
 * 获取用户的菜单权限（树形结构）
 * @param userId 用户ID
 * @returns 菜单树
 */
export async function getUserMenus(userId: number): Promise<MenuItem[]> {
  // 尝试从缓存获取
  const cacheKey = String(userId);
  const cached = userMenuCache.get<MenuItem[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const permissions = await getUserPermissions(userId);
  
  // 过滤出菜单权限
  const menuPermissions = permissions.filter((p) => p.type === 'menu');
  
  // 构建树形结构
  const menuTree = buildMenuTree(menuPermissions, null);
  
  // 存入缓存
  userMenuCache.set(cacheKey, menuTree);
  
  return menuTree;
}

/**
 * 构建菜单树
 * @param items 权限列表
 * @param parentId 父ID
 * @returns 菜单树
 */
function buildMenuTree(items: PermissionInfo[], parentId: number | null): MenuItem[] {
  const result: MenuItem[] = [];
  
  // 找出所有直接子节点
  const children = items
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  
  for (const child of children) {
    const menuItem: MenuItem = {
      id: child.id,
      code: child.code,
      name: child.name,
      path: child.path,
      icon: child.icon,
      parentId: child.parentId,
      sortOrder: child.sortOrder,
      children: buildMenuTree(items, child.id),
    };
    result.push(menuItem);
  }
  
  return result;
}

/**
 * 获取用户的API权限
 * @param userId 用户ID
 * @returns API权限映射（路径 -> 方法列表）
 */
export async function getUserApiPermissions(
  userId: number
): Promise<Map<string, string[]>> {
  const permissions = await getUserPermissions(userId);
  
  // 过滤出API权限
  const apiPermissions = permissions.filter((p) => p.type === 'api' && p.path);
  
  // 构建路径 -> 方法映射
  const apiMap = new Map<string, string[]>();
  
  for (const perm of apiPermissions) {
    if (!perm.path) continue;
    
    const methods = apiMap.get(perm.path) || [];
    if (perm.method && !methods.includes(perm.method)) {
      methods.push(perm.method);
      apiMap.set(perm.path, methods);
    } else if (!perm.method) {
      // 如果没有指定方法，则允许所有方法
      apiMap.set(perm.path, ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    }
  }
  
  return apiMap;
}

/**
 * 检查用户是否可以访问指定API
 * @param userId 用户ID
 * @param path API路径
 * @param method HTTP方法
 * @returns 是否有权限
 */
export async function canAccessApi(
  userId: number,
  path: string,
  method: string
): Promise<boolean> {
  const apiPermissions = await getUserApiPermissions(userId);
  
  // 检查精确匹配
  const methods = apiPermissions.get(path);
  if (methods && (methods.includes(method) || methods.length === 0)) {
    return true;
  }
  
  // 检查通配符匹配（如 /api/projects/*）
  for (const [apiPath, methods] of apiPermissions.entries()) {
    if (apiPath.endsWith('/*')) {
      const basePath = apiPath.slice(0, -2);
      if (path.startsWith(basePath)) {
        if (methods.includes(method) || methods.length === 0) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 清除用户权限缓存
 * 当用户角色或权限变更时调用
 */
export function clearUserPermissionCache(userId: number): void {
  invalidateUserCache(userId);
}

// 重新导出缓存失效函数
export { invalidateUserCache } from '@/lib/cache/service';

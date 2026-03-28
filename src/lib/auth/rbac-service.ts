/**
 * RBAC 服务类
 * 提供角色、权限管理和权限检查功能
 */

import { db } from '@/db/index';
import { roles, permissions, userRoles, rolePermissions, dataPermissions, permissionLogs } from '@/db/schema/rbac';
import { users } from '@/db/schema/users';
import { eq, and, or, inArray, exists, sql } from 'drizzle-orm';
import { cache } from '@/lib/cache';

// ============================================
// 类型定义
// ============================================

export type RoleLevel = 'admin' | 'manager' | 'normal' | 'guest';
export type ResourceScope = 'all' | 'department' | 'own' | 'custom';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export' | 'import' | 'manage';

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  level: RoleLevel;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  resourceType: string;
  action: string;
  module: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface DataPermission {
  id: string;
  roleId: string;
  resourceType: string;
  scope: ResourceScope;
  conditions?: Record<string, any>;
}

// ============================================
// 预定义角色和权限
// ============================================

export const DEFAULT_ROLES: Omit<Role, 'id' | 'permissions' | 'isSystem'>[] = [
  {
    name: '超级管理员',
    code: 'super_admin',
    level: 'admin',
    description: '拥有系统所有权限',
    isActive: true,
  },
  {
    name: '部门经理',
    code: 'department_manager',
    level: 'manager',
    description: '管理部门内的项目和人员',
    isActive: true,
  },
  {
    name: '项目经理',
    code: 'project_manager',
    level: 'manager',
    description: '管理项目的全流程',
    isActive: true,
  },
  {
    name: '普通用户',
    code: 'normal_user',
    level: 'normal',
    description: '标准用户权限',
    isActive: true,
  },
  {
    name: '审核人员',
    code: 'reviewer',
    level: 'normal',
    description: '负责审核文档和项目',
    isActive: true,
  },
  {
    name: '财务人员',
    code: 'finance',
    level: 'normal',
    description: '负责财务相关操作',
    isActive: true,
  },
  {
    name: '访客',
    code: 'guest',
    level: 'guest',
    description: '只读权限',
    isActive: true,
  },
];

export const DEFAULT_PERMISSIONS: Omit<Permission, 'id' | 'isSystem'>[] = [
  // 项目权限
  { code: 'project:create', name: '创建项目', resourceType: 'project', action: 'create', module: 'project', isActive: true },
  { code: 'project:read', name: '查看项目', resourceType: 'project', action: 'read', module: 'project', isActive: true },
  { code: 'project:update', name: '编辑项目', resourceType: 'project', action: 'update', module: 'project', isActive: true },
  { code: 'project:delete', name: '删除项目', resourceType: 'project', action: 'delete', module: 'project', isActive: true },
  { code: 'project:approve', name: '审核项目', resourceType: 'project', action: 'approve', module: 'project', isActive: true },
  { code: 'project:export', name: '导出项目', resourceType: 'project', action: 'export', module: 'project', isActive: true },
  
  // 文档权限
  { code: 'document:create', name: '创建文档', resourceType: 'document', action: 'create', module: 'document', isActive: true },
  { code: 'document:read', name: '查看文档', resourceType: 'document', action: 'read', module: 'document', isActive: true },
  { code: 'document:update', name: '编辑文档', resourceType: 'document', action: 'update', module: 'document', isActive: true },
  { code: 'document:delete', name: '删除文档', resourceType: 'document', action: 'delete', module: 'document', isActive: true },
  { code: 'document:upload', name: '上传文档', resourceType: 'document', action: 'create', module: 'document', isActive: true },
  { code: 'document:download', name: '下载文档', resourceType: 'document', action: 'read', module: 'document', isActive: true },
  
  // 审核权限
  { code: 'review:create', name: '发起审核', resourceType: 'review', action: 'create', module: 'review', isActive: true },
  { code: 'review:read', name: '查看审核', resourceType: 'review', action: 'read', module: 'review', isActive: true },
  { code: 'review:approve', name: '审核通过', resourceType: 'review', action: 'approve', module: 'review', isActive: true },
  { code: 'review:reject', name: '审核拒绝', resourceType: 'review', action: 'update', module: 'review', isActive: true },
  
  // 用户权限
  { code: 'user:create', name: '创建用户', resourceType: 'user', action: 'create', module: 'user', isActive: true },
  { code: 'user:read', name: '查看用户', resourceType: 'user', action: 'read', module: 'user', isActive: true },
  { code: 'user:update', name: '编辑用户', resourceType: 'user', action: 'update', module: 'user', isActive: true },
  { code: 'user:delete', name: '删除用户', resourceType: 'user', action: 'delete', module: 'user', isActive: true },
  { code: 'user:manage', name: '管理用户', resourceType: 'user', action: 'manage', module: 'user', isActive: true },
  
  // 角色权限
  { code: 'role:create', name: '创建角色', resourceType: 'role', action: 'create', module: 'system', isActive: true },
  { code: 'role:read', name: '查看角色', resourceType: 'role', action: 'read', module: 'system', isActive: true },
  { code: 'role:update', name: '编辑角色', resourceType: 'role', action: 'update', module: 'system', isActive: true },
  { code: 'role:delete', name: '删除角色', resourceType: 'role', action: 'delete', module: 'system', isActive: true },
  { code: 'role:assign', name: '分配角色', resourceType: 'role', action: 'manage', module: 'system', isActive: true },
  
  // 公司权限
  { code: 'company:create', name: '创建公司', resourceType: 'company', action: 'create', module: 'company', isActive: true },
  { code: 'company:read', name: '查看公司', resourceType: 'company', action: 'read', module: 'company', isActive: true },
  { code: 'company:update', name: '编辑公司', resourceType: 'company', action: 'update', module: 'company', isActive: true },
  { code: 'company:delete', name: '删除公司', resourceType: 'company', action: 'delete', module: 'company', isActive: true },
  
  // 系统权限
  { code: 'system:config', name: '系统配置', resourceType: 'system', action: 'manage', module: 'system', isActive: true },
  { code: 'system:monitor', name: '系统监控', resourceType: 'system', action: 'read', module: 'system', isActive: true },
  { code: 'system:audit', name: '审计日志', resourceType: 'system', action: 'read', module: 'system', isActive: true },
];

// ============================================
// RBAC 服务类
// ============================================

export class RBACService {
  /**
   * 初始化默认角色和权限
   */
  static async initializeDefaults(): Promise<{ success: boolean; message: string }> {
    try {
      // 创建默认权限
      for (const perm of DEFAULT_PERMISSIONS) {
        const existing = await db.query.permissions.findFirst({
          where: eq(permissions.code, perm.code),
        });

        if (!existing) {
          await db.insert(permissions).values({
            ...perm,
            isSystem: true,
          });
        }
      }

      // 创建默认角色并分配权限
      for (const roleDef of DEFAULT_ROLES) {
        const existingRole = await db.query.roles.findFirst({
          where: eq(roles.code, roleDef.code),
        });

        if (!existingRole) {
          const [newRole] = await db.insert(roles).values({
            ...roleDef,
            isSystem: true,
            permissions: [], // 稍后填充
          }).returning();

          // 根据角色类型分配权限
          const rolePermissions = this.getPermissionsForRole(roleDef.code);
          
          for (const permCode of rolePermissions) {
            const perm = await db.query.permissions.findFirst({
              where: eq(permissions.code, permCode),
            });

            if (perm) {
              await db.insert(rolePermissions).values({
                roleId: newRole.id,
                permissionId: perm.id,
              });
            }
          }

          // 更新角色的权限列表缓存
          newRole.permissions = rolePermissions;
          await db.update(roles)
            .set({ permissions: rolePermissions })
            .where(eq(roles.id, newRole.id));
        }
      }

      return {
        success: true,
        message: '默认角色和权限初始化成功'
      };
    } catch (error) {
      console.error('[RBAC] 初始化默认角色和权限失败:', error);
      return {
        success: false,
        message: `初始化失败: ${error}`
      };
    }
  }

  /**
   * 获取角色的默认权限列表
   */
  private static getPermissionsForRole(roleCode: string): string[] {
    const allPerms = DEFAULT_PERMISSIONS.map(p => p.code);

    switch (roleCode) {
      case 'super_admin':
        return allPerms; // 所有权限
      
      case 'department_manager':
        return [
          'project:read', 'project:update', 'project:approve', 'project:export',
          'document:read', 'document:update', 'document:upload', 'document:download',
          'review:create', 'review:read', 'review:approve',
          'user:read', 'user:update',
          'company:read',
          'system:monitor',
        ];
      
      case 'project_manager':
        return [
          'project:create', 'project:read', 'project:update', 'project:export',
          'document:create', 'document:read', 'document:update', 'document:upload', 'document:download',
          'review:create', 'review:read',
          'user:read',
          'company:read',
        ];
      
      case 'normal_user':
        return [
          'project:read',
          'document:create', 'document:read', 'document:upload', 'document:download',
          'review:create', 'review:read',
        ];
      
      case 'reviewer':
        return [
          'project:read',
          'document:read', 'document:download',
          'review:read', 'review:approve', 'review:reject',
        ];
      
      case 'finance':
        return [
          'project:read',
          'document:read', 'document:download',
          'review:read',
        ];
      
      case 'guest':
        return [
          'project:read',
          'document:read',
        ];
      
      default:
        return [];
    }
  }

  /**
   * 检查用户是否拥有指定权限
   */
  static async hasPermission(
    userId: string,
    permissionCode: string,
    resourceId?: string
  ): Promise<boolean> {
    try {
      // 检查缓存
      const cacheKey = `rbac:permission:${userId}:${permissionCode}`;
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }

      // 获取用户的角色
      const userRolesData = await db.query.userRoles.findMany({
        where: eq(userRoles.userId, userId),
        with: {
          role: true,
        },
      });

      if (userRolesData.length === 0) {
        return false;
      }

      // 检查是否有超级管理员角色
      const hasSuperAdmin = userRolesData.some(ur => ur.role.code === 'super_admin');
      if (hasSuperAdmin) {
        await cache.set(cacheKey, 'true', 300); // 缓存5分钟
        return true;
      }

      // 获取所有角色ID
      const roleIds = userRolesData.map(ur => ur.roleId);

      // 检查是否有权限
      const hasPerm = await db.query.rolePermissions.findFirst({
        where: and(
          inArray(rolePermissions.roleId, roleIds),
          eq(rolePermissions.permissionId, sql`(SELECT id FROM permissions WHERE code = ${permissionCode})`)
        ),
      });

      const result = !!hasPerm;
      await cache.set(cacheKey, result ? 'true' : 'false', 300);
      return result;
    } catch (error) {
      console.error('[RBAC] 检查权限失败:', error);
      return false;
    }
  }

  /**
   * 检查用户是否拥有任意一个权限
   */
  static async hasAnyPermission(userId: string, permissionCodes: string[]): Promise<boolean> {
    for (const code of permissionCodes) {
      if (await this.hasPermission(userId, code)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查用户是否拥有所有权限
   */
  static async hasAllPermissions(userId: string, permissionCodes: string[]): Promise<boolean> {
    for (const code of permissionCodes) {
      if (!(await this.hasPermission(userId, code))) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取用户的所有权限
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    try {
      // 检查缓存
      const cacheKey = `rbac:permissions:${userId}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 获取用户的角色
      const userRolesData = await db.query.userRoles.findMany({
        where: eq(userRoles.userId, userId),
        with: {
          role: true,
        },
      });

      if (userRolesData.length === 0) {
        return [];
      }

      // 检查是否有超级管理员角色
      const hasSuperAdmin = userRolesData.some(ur => ur.role.code === 'super_admin');
      if (hasSuperAdmin) {
        const allPerms = DEFAULT_PERMISSIONS.map(p => p.code);
        await cache.set(cacheKey, JSON.stringify(allPerms), 300);
        return allPerms;
      }

      // 获取所有角色ID
      const roleIds = userRolesData.map(ur => ur.roleId);

      // 获取所有权限
      const permsData = await db.query.rolePermissions.findMany({
        where: inArray(rolePermissions.roleId, roleIds),
        with: {
          permission: true,
        },
      });

      const permCodes = Array.from(new Set(permsData.map(rp => rp.permission.code)));
      await cache.set(cacheKey, JSON.stringify(permCodes), 300);
      return permCodes;
    } catch (error) {
      console.error('[RBAC] 获取用户权限失败:', error);
      return [];
    }
  }

  /**
   * 为用户分配角色
   */
  static async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 检查是否已存在
      const existing = await db.query.userRoles.findFirst({
        where: and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        ),
      });

      if (existing) {
        return {
          success: false,
          message: '用户已拥有该角色'
        };
      }

      // 分配角色
      await db.insert(userRoles).values({
        userId,
        roleId,
        assignedBy,
      });

      // 记录日志
      await db.insert(permissionLogs).values({
        userId,
        action: 'assign_role',
        targetType: 'role',
        targetId: roleId,
        details: { assignedBy },
      });

      // 清除缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '角色分配成功'
      };
    } catch (error) {
      console.error('[RBAC] 分配角色失败:', error);
      return {
        success: false,
        message: `分配角色失败: ${error}`
      };
    }
  }

  /**
   * 移除用户角色
   */
  static async removeRoleFromUser(
    userId: string,
    roleId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await db.delete(userRoles).where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId)
        )
      );

      // 记录日志
      await db.insert(permissionLogs).values({
        userId,
        action: 'remove_role',
        targetType: 'role',
        targetId: roleId,
      });

      // 清除缓存
      await this.clearUserCache(userId);

      return {
        success: true,
        message: '角色移除成功'
      };
    } catch (error) {
      console.error('[RBAC] 移除角色失败:', error);
      return {
        success: false,
        message: `移除角色失败: ${error}`
      };
    }
  }

  /**
   * 为角色分配权限
   */
  static async assignPermissionToRole(
    roleId: string,
    permissionId: string,
    assignedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 检查是否已存在
      const existing = await db.query.rolePermissions.findFirst({
        where: and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId)
        ),
      });

      if (existing) {
        return {
          success: false,
          message: '角色已拥有该权限'
        };
      }

      // 分配权限
      await db.insert(rolePermissions).values({
        roleId,
        permissionId,
        assignedBy,
      });

      // 记录日志
      await db.insert(permissionLogs).values({
        userId: assignedBy,
        action: 'grant_permission',
        targetType: 'permission',
        targetId: permissionId,
        details: { roleId },
      });

      // 更新角色的权限列表缓存
      await this.updateRolePermissionsCache(roleId);

      return {
        success: true,
        message: '权限分配成功'
      };
    } catch (error) {
      console.error('[RBAC] 分配权限失败:', error);
      return {
        success: false,
        message: `分配权限失败: ${error}`
      };
    }
  }

  /**
   * 移除角色权限
   */
  static async removePermissionFromRole(
    roleId: string,
    permissionId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await db.delete(rolePermissions).where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId)
        )
      );

      // 记录日志
      await db.insert(permissionLogs).values({
        userId: roleId, // 这里应该记录操作者
        action: 'revoke_permission',
        targetType: 'permission',
        targetId: permissionId,
        details: { roleId },
      });

      // 更新角色的权限列表缓存
      await this.updateRolePermissionsCache(roleId);

      return {
        success: true,
        message: '权限移除成功'
      };
    } catch (error) {
      console.error('[RBAC] 移除权限失败:', error);
      return {
        success: false,
        message: `移除权限失败: ${error}`
      };
    }
  }

  /**
   * 清除用户缓存
   */
  private static async clearUserCache(userId: string): Promise<void> {
    const patterns = [
      `rbac:permission:${userId}:*`,
      `rbac:permissions:${userId}`,
    ];

    for (const pattern of patterns) {
      // 这里需要实现通配符删除，根据Redis客户端的不同实现
      await cache.del(pattern);
    }
  }

  /**
   * 更新角色权限缓存
   */
  private static async updateRolePermissionsCache(roleId: string): Promise<void> {
    // 获取角色的所有权限
    const rolePerms = await db.query.rolePermissions.findMany({
      where: eq(rolePermissions.roleId, roleId),
      with: {
        permission: true,
      },
    });

    const permCodes = rolePerms.map(rp => rp.permission.code);

    // 更新角色表中的权限列表
    await db.update(roles)
      .set({ permissions: permCodes })
      .where(eq(roles.id, roleId));

    // 清除所有拥有该角色的用户的缓存
    const userRolesData = await db.query.userRoles.findMany({
      where: eq(userRoles.roleId, roleId),
    });

    for (const ur of userRolesData) {
      await this.clearUserCache(ur.userId);
    }
  }

  /**
   * 获取所有角色
   */
  static async getAllRoles(): Promise<Role[]> {
    try {
      const rolesData = await db.query.roles.findMany({
        where: eq(roles.isActive, true),
        orderBy: (roles, { asc }) => [asc(roles.level), asc(roles.name)],
      });

      return rolesData.map(role => ({
        id: role.id,
        name: role.name,
        code: role.code,
        description: role.description || undefined,
        level: role.level as RoleLevel,
        permissions: (role.permissions as string[]) || [],
        isSystem: role.isSystem,
        isActive: role.isActive,
      }));
    } catch (error) {
      console.error('[RBAC] 获取角色列表失败:', error);
      return [];
    }
  }

  /**
   * 获取所有权限
   */
  static async getAllPermissions(): Promise<Permission[]> {
    try {
      const permsData = await db.query.permissions.findMany({
        where: eq(permissions.isActive, true),
        orderBy: (permissions, { asc }) => [asc(permissions.module), asc(permissions.resourceType), asc(permissions.action)],
      });

      return permsData.map(perm => ({
        id: perm.id,
        code: perm.code,
        name: perm.name,
        description: perm.description || undefined,
        resourceType: perm.resourceType,
        action: perm.action,
        module: perm.module,
        isSystem: perm.isSystem,
        isActive: perm.isActive,
      }));
    } catch (error) {
      console.error('[RBAC] 获取权限列表失败:', error);
      return [];
    }
  }
}

// ============================================
// 导出
// ============================================

export default RBACService;

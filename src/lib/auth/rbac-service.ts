/**
 * RBAC 服务
 * 提供角色、权限初始化与权限检查能力
 */

import { db } from '@/db/index';
import { roles, permissions, userRoles, rolePermissions } from '@/db/schema/rbac';
import { and, eq, inArray } from 'drizzle-orm';

export type RoleLevel = 'admin' | 'manager' | 'normal' | 'guest';
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export' | 'import' | 'manage';

export interface RoleRow {
  id: number;
  name: string;
  code: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  level: number;
}

export interface PermissionRow {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  resource: string;
  action: string;
}

export const DEFAULT_ROLES: Array<{
  name: string;
  code: string;
  level: RoleLevel;
  description?: string;
  isActive: boolean;
}> = [
  { name: '超级管理员', code: 'super_admin', level: 'admin', description: '拥有系统所有权限', isActive: true },
  { name: '部门经理', code: 'department_manager', level: 'manager', description: '管理部门内的项目和人员', isActive: true },
  { name: '项目经理', code: 'project_manager', level: 'manager', description: '管理项目的全流程', isActive: true },
  { name: '普通用户', code: 'normal_user', level: 'normal', description: '标准用户权限', isActive: true },
  { name: '审核人员', code: 'reviewer', level: 'normal', description: '负责审核文档和项目', isActive: true },
  { name: '财务人员', code: 'finance', level: 'normal', description: '负责财务相关操作', isActive: true },
  { name: '访客', code: 'guest', level: 'guest', description: '只读权限', isActive: true },
];

export const DEFAULT_PERMISSIONS: Array<{
  code: string;
  name: string;
  resource: string;
  action: PermissionAction;
  description?: string;
  isActive: boolean;
}> = [
  { code: 'project:create', name: '创建项目', resource: 'project', action: 'create', isActive: true },
  { code: 'project:read', name: '查看项目', resource: 'project', action: 'read', isActive: true },
  { code: 'project:update', name: '编辑项目', resource: 'project', action: 'update', isActive: true },
  { code: 'project:delete', name: '删除项目', resource: 'project', action: 'delete', isActive: true },
  { code: 'project:approve', name: '审核项目', resource: 'project', action: 'approve', isActive: true },
  { code: 'project:export', name: '导出项目', resource: 'project', action: 'export', isActive: true },

  { code: 'document:create', name: '创建文档', resource: 'document', action: 'create', isActive: true },
  { code: 'document:read', name: '查看文档', resource: 'document', action: 'read', isActive: true },
  { code: 'document:update', name: '编辑文档', resource: 'document', action: 'update', isActive: true },
  { code: 'document:delete', name: '删除文档', resource: 'document', action: 'delete', isActive: true },
  { code: 'document:upload', name: '上传文档', resource: 'document', action: 'create', isActive: true },
  { code: 'document:download', name: '下载文档', resource: 'document', action: 'read', isActive: true },

  { code: 'review:create', name: '发起审核', resource: 'review', action: 'create', isActive: true },
  { code: 'review:read', name: '查看审核', resource: 'review', action: 'read', isActive: true },
  { code: 'review:approve', name: '审核通过', resource: 'review', action: 'approve', isActive: true },
  { code: 'review:reject', name: '审核拒绝', resource: 'review', action: 'update', isActive: true },

  { code: 'user:create', name: '创建用户', resource: 'user', action: 'create', isActive: true },
  { code: 'user:read', name: '查看用户', resource: 'user', action: 'read', isActive: true },
  { code: 'user:update', name: '编辑用户', resource: 'user', action: 'update', isActive: true },
  { code: 'user:delete', name: '删除用户', resource: 'user', action: 'delete', isActive: true },
  { code: 'user:manage', name: '管理用户', resource: 'user', action: 'manage', isActive: true },

  { code: 'role:create', name: '创建角色', resource: 'role', action: 'create', isActive: true },
  { code: 'role:read', name: '查看角色', resource: 'role', action: 'read', isActive: true },
  { code: 'role:update', name: '编辑角色', resource: 'role', action: 'update', isActive: true },
  { code: 'role:delete', name: '删除角色', resource: 'role', action: 'delete', isActive: true },
  { code: 'role:assign', name: '分配角色', resource: 'role', action: 'manage', isActive: true },

  { code: 'company:create', name: '创建公司', resource: 'company', action: 'create', isActive: true },
  { code: 'company:read', name: '查看公司', resource: 'company', action: 'read', isActive: true },
  { code: 'company:update', name: '编辑公司', resource: 'company', action: 'update', isActive: true },
  { code: 'company:delete', name: '删除公司', resource: 'company', action: 'delete', isActive: true },

  { code: 'system:config', name: '系统配置', resource: 'system', action: 'manage', isActive: true },
  { code: 'system:monitor', name: '系统监控', resource: 'system', action: 'read', isActive: true },
  { code: 'system:audit', name: '审计日志', resource: 'system', action: 'read', isActive: true },
];

function mapRoleLevel(level: RoleLevel): number {
  if (level === 'admin') return 0;
  if (level === 'manager') return 1;
  if (level === 'guest') return 3;
  return 2;
}

function getPermissionCodesForRole(roleCode: string): string[] {
  if (roleCode === 'super_admin') return DEFAULT_PERMISSIONS.map((p) => p.code);
  if (roleCode === 'department_manager' || roleCode === 'project_manager') {
    return DEFAULT_PERMISSIONS.filter((p) => ['project', 'document', 'review'].includes(p.resource)).map((p) => p.code);
  }
  if (roleCode === 'reviewer') return DEFAULT_PERMISSIONS.filter((p) => ['review', 'document'].includes(p.resource)).map((p) => p.code);
  if (roleCode === 'finance') return DEFAULT_PERMISSIONS.filter((p) => p.action === 'export' || p.code === 'project:read').map((p) => p.code);
  if (roleCode === 'guest') return DEFAULT_PERMISSIONS.filter((p) => p.action === 'read').map((p) => p.code);
  return DEFAULT_PERMISSIONS.filter((p) => ['project:read', 'document:read'].includes(p.code)).map((p) => p.code);
}

export class RBACService {
  static async initializeDefaults(): Promise<{ success: boolean; message: string }> {
    try {
      for (const perm of DEFAULT_PERMISSIONS) {
        const existing = await db.query.permissions.findFirst({ where: eq(permissions.code, perm.code) });
        if (!existing) {
          await db.insert(permissions).values({
            code: perm.code,
            name: perm.name,
            description: perm.description,
            resource: perm.resource,
            action: perm.action,
            isActive: perm.isActive,
          });
        }
      }

      for (const roleDef of DEFAULT_ROLES) {
        const existingRole = await db.query.roles.findFirst({ where: eq(roles.code, roleDef.code) });
        if (!existingRole) {
          const [newRole] = await db
            .insert(roles)
            .values({
              name: roleDef.name,
              code: roleDef.code,
              description: roleDef.description,
              level: mapRoleLevel(roleDef.level),
              isSystem: true,
              isActive: roleDef.isActive,
            })
            .returning();

          const permCodes = getPermissionCodesForRole(roleDef.code);
          if (permCodes.length > 0) {
            const permRows = await db
              .select({ id: permissions.id })
              .from(permissions)
              .where(inArray(permissions.code, permCodes));

            if (permRows.length > 0) {
              await db.insert(rolePermissions).values(
                permRows.map((p) => ({
                  roleId: newRole.id,
                  permissionId: p.id,
                  grantedBy: null,
                }))
              );
            }
          }
        }
      }

      return { success: true, message: '默认角色和权限初始化成功' };
    } catch (error) {
      console.error('[RBAC] 初始化默认角色和权限失败:', error);
      return { success: false, message: '初始化失败' };
    }
  }

  static async updateRolePermissionsCache(_roleId: number | string): Promise<void> {
    return;
  }

  static async getUserPermissions(userId: string | number): Promise<string[]> {
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (!Number.isFinite(userIdNum)) return [];

    const rows = await db
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, userIdNum), eq(permissions.isActive, true)));

    return [...new Set(rows.map((r) => r.code))];
  }

  static async hasPermission(userId: string | number, permissionCode: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return perms.includes(permissionCode);
  }

  static async hasAnyPermission(userId: string | number, permissionCodes: string[]): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissionCodes.some((c) => perms.includes(c));
  }

  static async hasAllPermissions(userId: string | number, permissionCodes: string[]): Promise<boolean> {
    const perms = await this.getUserPermissions(userId);
    return permissionCodes.every((c) => perms.includes(c));
  }

  static async getAllRoles(): Promise<RoleRow[]> {
    const rows = await db.query.roles.findMany({
      where: eq(roles.isActive, true),
      orderBy: (t, { asc }) => [asc(t.level), asc(t.name)],
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description || undefined,
      isSystem: r.isSystem,
      isActive: r.isActive,
      level: r.level,
    }));
  }

  static async getAllPermissions(): Promise<PermissionRow[]> {
    const rows = await db.query.permissions.findMany({
      where: eq(permissions.isActive, true),
      orderBy: (t, { asc }) => [asc(t.resource), asc(t.action), asc(t.name)],
    });

    return rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description || undefined,
      isActive: p.isActive,
      resource: p.resource,
      action: p.action,
    }));
  }
}

export default RBACService;

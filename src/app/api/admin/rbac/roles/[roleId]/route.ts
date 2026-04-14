/**
 * 单个角色管理 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/index';
import { roles, rolePermissions, userRoles } from '@/db/schema/rbac';
import { eq, sql } from 'drizzle-orm';
import RBACService from '@/lib/auth/rbac-service';
import { withPermission, PERMISSIONS } from '@/lib/auth/rbac-middleware';
import { withAdmin } from '@/lib/auth/middleware';

// ============================================
// GET - 获取角色详情
// ============================================

async function getRoleDetail(roleId: string) {
  try {
    const roleIdNum = parseInt(roleId, 10);
    if (!Number.isFinite(roleIdNum)) {
      return NextResponse.json({ success: false, error: 'roleId 参数错误' }, { status: 400 });
    }

    // 获取角色信息
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleIdNum),
    });

    if (!role) {
      return NextResponse.json({
        success: false,
        error: '角色不存在',
      }, { status: 404 });
    }

    // 获取角色的权限
    const rolePerms = await db.query.rolePermissions.findMany({
      where: eq(rolePermissions.roleId, roleIdNum),
      with: {
        permission: true,
      },
    });

    // 获取角色的用户
    const roleUsers = await db.query.userRoles.findMany({
      where: eq(userRoles.roleId, roleIdNum),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            realName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...role,
        permissions: rolePerms.map(rp => rp.permission),
        users: roleUsers.map(ru => ru.user),
      },
    });
  } catch (error) {
    console.error('[Role API] 获取角色详情失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取角色详情失败',
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;
  return withAdmin(request, async () => getRoleDetail(roleId));
}

// ============================================
// PATCH - 更新角色
// ============================================

async function patchRole(
  request: NextRequest,
  roleId: string,
  authUserId: number
) {
    try {
      const roleIdNum = parseInt(roleId, 10);
      if (!Number.isFinite(roleIdNum)) {
        return NextResponse.json({ success: false, error: 'roleId 参数错误' }, { status: 400 });
      }
      const body = await request.json();
      const { name, description, level, isActive, permissions: permissionIds } = body;

      // 获取现有角色
      const existing = await db.query.roles.findFirst({
        where: eq(roles.id, roleIdNum),
      });

      if (!existing) {
        return NextResponse.json({
          success: false,
          error: '角色不存在',
        }, { status: 404 });
      }

      // 系统角色不允许修改关键信息
      if (existing.isSystem && (name || level)) {
        return NextResponse.json({
          success: false,
          error: '系统内置角色不允许修改名称、代码和级别',
        }, { status: 400 });
      }

      // 更新角色基本信息
      const updateData: any = {};
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (level) updateData.level = level;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (Object.keys(updateData).length > 0) {
        await db.update(roles)
          .set(updateData)
          .where(eq(roles.id, roleIdNum));
      }

      // 更新权限
      if (permissionIds !== undefined) {
        await db.transaction(async (tx) => {
          // 删除旧权限
          await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleIdNum));

          // 添加新权限
          const grantedBy = authUserId || null;
          for (const permId of permissionIds) {
            await tx.insert(rolePermissions).values({
              roleId: roleIdNum,
              permissionId: permId,
              grantedBy,
            });
          }
        });

        // 更新角色的权限列表缓存
        await RBACService.updateRolePermissionsCache(roleIdNum);
      }

      return NextResponse.json({
        success: true,
        message: '角色更新成功',
      });
    } catch (error) {
      console.error('[Role API] 更新角色失败:', error);
      return NextResponse.json({
        success: false,
        error: '更新角色失败',
      }, { status: 500 });
    }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const { roleId } = await params;
  return withAdmin(request, (req, userId) => patchRole(req, roleId, userId));
}

// ============================================
// DELETE - 删除角色
// ============================================

export const DELETE = withPermission(
  PERMISSIONS.ROLE_DELETE,
  async (request: NextRequest, context?: any) => {
    try {
      const p = await context?.params;
      const roleId = p?.roleId;
      const roleIdNum = parseInt(roleId, 10);
      if (!Number.isFinite(roleIdNum)) {
        return NextResponse.json({ success: false, error: 'roleId 参数错误' }, { status: 400 });
      }

      // 获取角色信息
      const role = await db.query.roles.findFirst({
        where: eq(roles.id, roleIdNum),
      });

      if (!role) {
        return NextResponse.json({
          success: false,
          error: '角色不存在',
        }, { status: 404 });
      }

      // 系统角色不允许删除
      if (role.isSystem) {
        return NextResponse.json({
          success: false,
          error: '系统内置角色不允许删除',
        }, { status: 400 });
      }

      // 检查是否有用户使用该角色
      const userCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(userRoles)
        .where(eq(userRoles.roleId, roleIdNum));

      if (Number(userCount[0]?.count || 0) > 0) {
        return NextResponse.json({
          success: false,
          error: '该角色正在使用中，无法删除',
        }, { status: 400 });
      }

      // 删除角色
      await db.delete(roles).where(eq(roles.id, roleIdNum));

      return NextResponse.json({
        success: true,
        message: '角色删除成功',
      });
    } catch (error) {
      console.error('[Role API] 删除角色失败:', error);
      return NextResponse.json({
        success: false,
        error: '删除角色失败',
      }, { status: 500 });
    }
  }
);

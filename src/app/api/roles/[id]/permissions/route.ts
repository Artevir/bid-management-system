/**
 * 角色权限分配API
 * GET: 获取角色的权限列表
 * PUT: 设置角色的权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { roles, rolePermissions, permissions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { withAuth, withAdmin, clearPermissionCache } from '@/lib/auth/middleware';

// 获取角色的权限列表
async function getRolePermissions(
  request: NextRequest,
  userId: number,
  roleId: number
): Promise<NextResponse> {
  try {
    // 检查角色是否存在
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });

    if (!role) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 获取角色的权限ID列表
    const rolePerms = await db.query.rolePermissions.findMany({
      where: eq(rolePermissions.roleId, roleId),
      columns: { permissionId: true },
    });

    const permissionIds = rolePerms.map((rp) => rp.permissionId);

    // 获取权限详情
    let perms: typeof permissions.$inferSelect[] = [];
    if (permissionIds.length > 0) {
      perms = await db.query.permissions.findMany({
        where: inArray(permissions.id, permissionIds),
      });
    }

    return NextResponse.json({
      roleId,
      roleName: role.name,
      permissions: perms,
      permissionIds,
    });
  } catch (error) {
    console.error('Get role permissions error:', error);
    return NextResponse.json({ error: '获取角色权限失败' }, { status: 500 });
  }
}

// 设置角色的权限
async function setRolePermissions(
  request: NextRequest,
  userId: number,
  roleId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { permissionIds }: { permissionIds: number[] } = body;

    if (!Array.isArray(permissionIds)) {
      return NextResponse.json({ error: '权限ID列表格式错误' }, { status: 400 });
    }

    // 检查角色是否存在
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });

    if (!role) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 不允许修改系统内置角色的权限
    if (role.isSystem) {
      return NextResponse.json({ error: '系统内置角色不允许修改权限' }, { status: 400 });
    }

    // 验证权限ID是否有效
    if (permissionIds.length > 0) {
      const validPerms = await db.query.permissions.findMany({
        where: inArray(permissions.id, permissionIds),
        columns: { id: true },
      });

      const validIds = validPerms.map((p) => p.id);
      const invalidIds = permissionIds.filter((id) => !validIds.includes(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: '部分权限ID无效', invalidIds },
          { status: 400 }
        );
      }
    }

    // 删除原有权限
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // 添加新权限
    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((permId) => ({
          roleId,
          permissionId: permId,
          grantedBy: userId,
        }))
      );
    }

    // 清除权限缓存
    clearPermissionCache();

    return NextResponse.json({
      success: true,
      message: '权限设置成功',
      permissionCount: permissionIds.length,
    });
  } catch (error) {
    console.error('Set role permissions error:', error);
    return NextResponse.json({ error: '设置角色权限失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getRolePermissions(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAdmin(request, (req, userId) => setRolePermissions(req, userId, parseInt(id)));
}

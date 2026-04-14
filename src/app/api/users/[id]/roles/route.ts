/**
 * 用户角色管理API
 * GET: 获取用户的角色列表
 * PUT: 设置用户的角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, roles, userRoles } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { withAdmin, clearPermissionCache } from '@/lib/auth/middleware';

// 获取用户的角色列表
async function getUserRoles(
  request: NextRequest,
  currentUserId: number,
  targetUserId: number
): Promise<NextResponse> {
  try {
    // 检查用户是否存在
    const user = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      columns: { id: true, username: true, realName: true },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 获取用户的角色
    const userRoleList = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, targetUserId),
      with: {
        role: {
          columns: {
            id: true,
            code: true,
            name: true,
            level: true,
            isSystem: true,
          },
        },
      },
    });

    const roles = userRoleList.map((ur) => ({
      ...ur.role,
      assignedAt: ur.assignedAt,
      expiresAt: ur.expiresAt,
    }));

    return NextResponse.json({
      user,
      roles,
      roleIds: userRoleList.map((ur) => ur.roleId),
    });
  } catch (error) {
    console.error('Get user roles error:', error);
    return NextResponse.json({ error: '获取用户角色失败' }, { status: 500 });
  }
}

// 设置用户的角色
async function setUserRoles(
  request: NextRequest,
  currentUserId: number,
  targetUserId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { roleIds }: { roleIds: number[] } = body;

    if (!Array.isArray(roleIds)) {
      return NextResponse.json({ error: '角色ID列表格式错误' }, { status: 400 });
    }

    // 检查用户是否存在
    const user = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 验证角色ID是否有效
    if (roleIds.length > 0) {
      const validRoles = await db.query.roles.findMany({
        where: inArray(roles.id, roleIds),
        columns: { id: true, isActive: true },
      });

      const validIds = validRoles.filter((r) => r.isActive).map((r) => r.id);
      const invalidIds = roleIds.filter((id) => !validIds.includes(id));

      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: '部分角色ID无效或已禁用', invalidIds },
          { status: 400 }
        );
      }
    }

    await db.transaction(async (tx) => {
      // 删除原有角色
      await tx.delete(userRoles).where(eq(userRoles.userId, targetUserId));

      // 添加新角色
      if (roleIds.length > 0) {
        await tx.insert(userRoles).values(
          roleIds.map((roleId) => ({
            userId: targetUserId,
            roleId,
            assignedBy: currentUserId,
          }))
        );
      }
    });

    // 清除权限缓存
    clearPermissionCache(targetUserId);

    return NextResponse.json({
      success: true,
      message: '角色设置成功',
      roleCount: roleIds.length,
    });
  } catch (error) {
    console.error('Set user roles error:', error);
    return NextResponse.json({ error: '设置用户角色失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAdmin(request, (req, userId) => getUserRoles(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAdmin(request, (req, userId) => setUserRoles(req, userId, parseInt(id)));
}

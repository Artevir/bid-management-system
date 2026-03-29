/**
 * 单个角色操作API
 * GET: 获取角色详情
 * PUT: 更新角色
 * DELETE: 删除角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { roles, rolePermissions, permissions as _permissions } from '@/db/schema';
import { eq, inArray as _inArray } from 'drizzle-orm';
import { withAuth, withAdmin, clearPermissionCache } from '@/lib/auth/middleware';

// 获取角色详情
async function getRole(
  request: NextRequest,
  userId: number,
  roleId: number
): Promise<NextResponse> {
  try {
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
      with: {
        rolePermissions: {
          with: {
            permission: {
              columns: {
                id: true,
                code: true,
                name: true,
                type: true,
                resource: true,
                action: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    return NextResponse.json({ role });
  } catch (error) {
    console.error('Get role error:', error);
    return NextResponse.json({ error: '获取角色详情失败' }, { status: 500 });
  }
}

// 更新角色
async function updateRole(
  request: NextRequest,
  userId: number,
  roleId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, description, level, isActive } = body;

    // 检查角色是否存在
    const existing = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });

    if (!existing) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 不允许修改系统内置角色
    if (existing.isSystem) {
      return NextResponse.json({ error: '系统内置角色不允许修改' }, { status: 400 });
    }

    // 更新角色
    const [updatedRole] = await db
      .update(roles)
      .set({
        name: name ?? existing.name,
        description: description ?? existing.description,
        level: level ?? existing.level,
        isActive: isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, roleId))
      .returning();

    return NextResponse.json({ role: updatedRole });
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json({ error: '更新角色失败' }, { status: 500 });
  }
}

// 删除角色
async function deleteRole(
  request: NextRequest,
  userId: number,
  roleId: number
): Promise<NextResponse> {
  try {
    // 检查角色是否存在
    const existing = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });

    if (!existing) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 不允许删除系统内置角色
    if (existing.isSystem) {
      return NextResponse.json({ error: '系统内置角色不允许删除' }, { status: 400 });
    }

    // 删除角色的权限关联
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    
    // 删除角色
    await db.delete(roles).where(eq(roles.id, roleId));

    // 清除权限缓存
    clearPermissionCache();

    return NextResponse.json({ success: true, message: '角色已删除' });
  } catch (error) {
    console.error('Delete role error:', error);
    return NextResponse.json({ error: '删除角色失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getRole(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAdmin(request, (req, userId) => updateRole(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAdmin(request, (req, userId) => deleteRole(req, userId, parseInt(id)));
}

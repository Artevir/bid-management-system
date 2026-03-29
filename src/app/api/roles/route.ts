/**
 * 角色管理API
 * GET: 获取角色列表
 * POST: 创建角色
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { roles, rolePermissions as _rolePermissions, permissions as _permissions } from '@/db/schema';
import { eq, inArray as _inArray, desc } from 'drizzle-orm';
import { withAuth, withAdmin, clearPermissionCache as _clearPermissionCache } from '@/lib/auth/middleware';

// 获取角色列表
async function getRoles(_request: NextRequest, _userId: number): Promise<NextResponse> {
  try {
    const roleList = await db.query.roles.findMany({
      orderBy: [desc(roles.createdAt)],
      with: {
        rolePermissions: {
          columns: {
            permissionId: true,
          },
        },
      },
    });

    // 简化返回数据
    const result = roleList.map((role) => ({
      ...role,
      permissionCount: role.rolePermissions.length,
      rolePermissions: undefined,
    }));

    return NextResponse.json({ roles: result });
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ error: '获取角色列表失败' }, { status: 500 });
  }
}

// 创建角色
async function createRole(request: NextRequest, _userId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, code, description, level = 1 } = body;

    if (!name || !code) {
      return NextResponse.json({ error: '角色名称和代码不能为空' }, { status: 400 });
    }

    // 检查角色代码是否已存在
    const existing = await db.query.roles.findFirst({
      where: eq(roles.code, code),
    });

    if (existing) {
      return NextResponse.json({ error: '角色代码已存在' }, { status: 400 });
    }

    // 创建角色
    const [newRole] = await db.insert(roles).values({
      name,
      code,
      description,
      level,
      isSystem: false,
      isActive: true,
    }).returning();

    return NextResponse.json({ role: newRole }, { status: 201 });
  } catch (error) {
    console.error('Create role error:', error);
    return NextResponse.json({ error: '创建角色失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getRoles);
}

export async function POST(request: NextRequest) {
  return withAdmin(request, createRole);
}

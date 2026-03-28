/**
 * 权限管理API
 * GET: 获取权限列表（支持树形结构）
 * POST: 创建权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { permissions } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { withAuth, withAdmin, clearPermissionCache } from '@/lib/auth/middleware';

// 权限树节点
interface PermissionTreeNode {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
  type: string;
  path: string | null;
  method: string | null;
  icon: string | null;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  children: PermissionTreeNode[];
}

// 构建权限树
function buildPermissionTree(
  items: (typeof permissions.$inferSelect)[],
  parentId: number | null = null
): PermissionTreeNode[] {
  const result: PermissionTreeNode[] = [];

  const children = items
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  for (const child of children) {
    const node: PermissionTreeNode = {
      id: child.id,
      code: child.code,
      name: child.name,
      resource: child.resource,
      action: child.action,
      type: child.type,
      path: child.path,
      method: child.method,
      icon: child.icon,
      parentId: child.parentId,
      sortOrder: child.sortOrder,
      isActive: child.isActive,
      children: buildPermissionTree(items, child.id),
    };
    result.push(node);
  }

  return result;
}

// 获取权限列表
async function getPermissions(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const tree = searchParams.get('tree') === 'true';
    const type = searchParams.get('type'); // 'menu' or 'api'

    // 构建查询条件
    let query = db.query.permissions.findMany({
      orderBy: [asc(permissions.sortOrder)],
    });

    const permList = await query;

    // 过滤类型
    const filtered = type ? permList.filter((p) => p.type === type) : permList;

    if (tree) {
      // 返回树形结构
      const tree = buildPermissionTree(filtered);
      return NextResponse.json({ permissions: tree });
    }

    // 返回平铺列表
    return NextResponse.json({ permissions: filtered });
  } catch (error) {
    console.error('Get permissions error:', error);
    return NextResponse.json({ error: '获取权限列表失败' }, { status: 500 });
  }
}

// 创建权限
async function createPermission(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      name,
      code,
      resource,
      action,
      description,
      parentId,
      type = 'menu',
      path,
      method,
      icon,
      sortOrder = 0,
    } = body;

    if (!name || !code || !resource || !action) {
      return NextResponse.json(
        { error: '权限名称、代码、资源和操作不能为空' },
        { status: 400 }
      );
    }

    // 检查权限代码是否已存在
    const existing = await db.query.permissions.findFirst({
      where: eq(permissions.code, code),
    });

    if (existing) {
      return NextResponse.json({ error: '权限代码已存在' }, { status: 400 });
    }

    // 创建权限
    const [newPerm] = await db
      .insert(permissions)
      .values({
        name,
        code,
        resource,
        action,
        description,
        parentId: parentId || null,
        type,
        path: path || null,
        method: method || null,
        icon: icon || null,
        sortOrder,
        isActive: true,
      })
      .returning();

    // 清除权限缓存
    clearPermissionCache();

    return NextResponse.json({ permission: newPerm }, { status: 201 });
  } catch (error) {
    console.error('Create permission error:', error);
    return NextResponse.json({ error: '创建权限失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getPermissions);
}

export async function POST(request: NextRequest) {
  return withAdmin(request, createPermission);
}

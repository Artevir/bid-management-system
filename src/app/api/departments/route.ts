/**
 * 部门管理API
 * GET: 获取部门列表
 * POST: 创建部门
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { departments } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { withAuth, withAdmin } from '@/lib/auth/middleware';

// 获取部门列表
async function getDepartments(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const deptList = await db.query.departments.findMany({
      orderBy: [asc(departments.sortOrder), asc(departments.name)],
    });

    return NextResponse.json({ departments: deptList });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json({ error: '获取部门列表失败' }, { status: 500 });
  }
}

// 创建部门
async function createDepartment(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, code, parentId, description, level, sortOrder } = body;

    if (!name || !code) {
      return NextResponse.json({ error: '部门名称和代码不能为空' }, { status: 400 });
    }

    // 检查部门代码是否已存在
    const existing = await db.query.departments.findFirst({
      where: eq(departments.code, code),
    });

    if (existing) {
      return NextResponse.json({ error: '部门代码已存在' }, { status: 400 });
    }

    // 创建部门
    const [newDept] = await db
      .insert(departments)
      .values({
        name,
        code,
        parentId: parentId || null,
        description: description || null,
        level: level || 1,
        sortOrder: sortOrder || 0,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ department: newDept }, { status: 201 });
  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json({ error: '创建部门失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getDepartments);
}

export async function POST(request: NextRequest) {
  return withAdmin(request, createDepartment);
}

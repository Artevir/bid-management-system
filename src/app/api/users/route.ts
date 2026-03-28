/**
 * 用户管理API
 * GET: 获取用户列表
 * POST: 创建用户
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, departments } from '@/db/schema';
import { eq, like, or, desc } from 'drizzle-orm';
import { withAuth, withAdmin } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';

// 获取用户列表
async function getUsers(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        realName: users.realName,
        phone: users.phone,
        departmentId: users.departmentId,
        position: users.position,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users);

    // 搜索过滤
    if (search) {
      query = query.where(
        or(
          like(users.username, `%${search}%`),
          like(users.realName, `%${search}%`),
          like(users.email, `%${search}%`)
        )
      ) as any;
    }

    const userList = await query.orderBy(desc(users.createdAt));

    return NextResponse.json({ users: userList });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// 创建用户
async function createUser(request: NextRequest, currentUserId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { username, email, password, realName, phone, departmentId, position } = body;

    if (!username || !email || !password || !realName || !departmentId) {
      return NextResponse.json({ error: '必填字段不能为空' }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUsername) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }

    // 检查邮箱是否已存在
    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingEmail) {
      return NextResponse.json({ error: '邮箱已存在' }, { status: 400 });
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 创建用户
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        realName,
        phone: phone || null,
        departmentId,
        position: position || null,
        status: 'active',
      })
      .returning();

    return NextResponse.json(
      {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          realName: newUser.realName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getUsers);
}

export async function POST(request: NextRequest) {
  return withAdmin(request, createUser);
}

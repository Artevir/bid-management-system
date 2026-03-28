/**
 * 单个用户操作API
 * GET: 获取用户详情
 * PUT: 更新用户
 * DELETE: 删除用户
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, withAdmin } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth/password';

// 获取用户详情
async function getUser(
  request: NextRequest,
  currentUserId: number,
  targetUserId: number
): Promise<NextResponse> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      columns: {
        id: true,
        username: true,
        email: true,
        realName: true,
        phone: true,
        avatar: true,
        departmentId: true,
        position: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: '获取用户详情失败' }, { status: 500 });
  }
}

// 更新用户
async function updateUser(
  request: NextRequest,
  currentUserId: number,
  targetUserId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email, password, realName, phone, departmentId, position, status } = body;

    // 检查用户是否存在
    const existing = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!existing) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 构建更新数据
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (email) updateData.email = email;
    if (realName) updateData.realName = realName;
    if (phone !== undefined) updateData.phone = phone || null;
    if (departmentId) updateData.departmentId = departmentId;
    if (position !== undefined) updateData.position = position || null;
    if (status) updateData.status = status as 'active' | 'inactive' | 'locked';

    // 如果提供了新密码，则更新密码
    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    // 更新用户
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetUserId))
      .returning();

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        realName: updatedUser.realName,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}

// 删除用户
async function deleteUser(
  request: NextRequest,
  currentUserId: number,
  targetUserId: number
): Promise<NextResponse> {
  try {
    // 不能删除自己
    if (currentUserId === targetUserId) {
      return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
    }

    // 检查用户是否存在
    const existing = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!existing) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 删除用户
    await db.delete(users).where(eq(users.id, targetUserId));

    return NextResponse.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getUser(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAdmin(request, (req, userId) => updateUser(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAdmin(request, (req, userId) => deleteUser(req, userId, parseInt(id)));
}

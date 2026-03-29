/**
 * 获取当前用户信息API
 * GET /api/auth/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET(_request: NextRequest) {
  try {
    // 获取当前用户
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }
    
    // 获取用户完整信息
    const user = await db.query.users.findFirst({
      where: eq(users.id, currentUser.userId),
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
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }
    
    // TODO: 获取用户角色和权限
    
    return NextResponse.json({
      user,
    });
    
  } catch (error) {
    console.error('Get current user error:', error);
    
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}

/**
 * 通知设置API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 获取当前用户ID
async function getCurrentUserId(): Promise<number | null> {
  const session = await getSession();
  if (!session || !session.user) return null;
  return session.user.id;
}

// GET /api/notification-settings - 获取通知设置
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 获取用户信息
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 从用户配置中获取通知设置，或返回默认设置
    const settings = {
      email: {
        enabled: true,
        address: user.email || '',
        verified: !!user.email,
      },
      sms: {
        enabled: false,
        phone: user.phone || '',
        verified: !!user.phone,
      },
      wechat: {
        enabled: false,
        openid: '',
        bound: false,
      },
      web: {
        enabled: true,
        browserSupported: true,
      },
      preferences: {
        projectReminder: true,
        approvalNotification: true,
        deadlineAlert: true,
        systemNotice: true,
        weeklyReport: false,
        dailyDigest: false,
      },
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('获取通知设置失败:', error);
    return NextResponse.json({ error: '获取通知设置失败' }, { status: 500 });
  }
}

// PUT /api/notification-settings - 更新通知设置
export async function PUT(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    
    // 这里可以将设置存储到用户配置表中
    // 目前只返回成功响应，实际项目中应该持久化
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新通知设置失败:', error);
    return NextResponse.json({ error: '更新通知设置失败' }, { status: 500 });
  }
}

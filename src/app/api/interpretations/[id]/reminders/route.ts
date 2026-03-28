/**
 * 时间提醒API
 * GET: 获取时间提醒列表
 * POST: 创建时间提醒
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getTimeReminders, createTimeReminder } from '@/lib/interpretation/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const reminders = await getTimeReminders(interpretationId);

    // 计算即将到期的提醒
    const now = new Date();
    const upcoming = reminders.filter(r => !r.isReminded && new Date(r.targetTime) > now);
    const overdue = reminders.filter(r => !r.isReminded && new Date(r.targetTime) <= now);

    return NextResponse.json({
      success: true,
      data: reminders,
      stats: {
        total: reminders.length,
        upcoming: upcoming.length,
        overdue: overdue.length,
      },
    });
  } catch (error) {
    console.error('获取时间提醒失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    const { reminderType, targetTime, reminderDays, reminderMethod, reminderContent, userId } = body;

    if (!reminderType || !targetTime || !reminderContent) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const reminderId = await createTimeReminder(
      interpretationId,
      {
        reminderType,
        targetTime: new Date(targetTime),
        reminderDays,
        reminderMethod,
        reminderContent,
        userId: userId || user.userId,
      },
      user.userId
    );

    return NextResponse.json({
      success: true,
      data: { id: reminderId },
      message: '创建成功',
    });
  } catch (error) {
    console.error('创建时间提醒失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}

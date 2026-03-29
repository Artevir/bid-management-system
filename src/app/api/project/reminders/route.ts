/**
 * 项目提醒API
 * GET: 获取待发送提醒
 * POST: 触发提醒检查
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  checkAndSendMilestoneReminders,
  getPendingReminders,
  triggerMilestoneReminder,
  getProjectReminderConfig,
  updateMilestoneReminderDays,
  batchSetProjectReminderDays,
} from '@/lib/project/reminder';

// 获取待发送提醒
async function getReminders(
  _request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const reminders = await getPendingReminders();

    return NextResponse.json({
      reminders,
      total: reminders.length,
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    return NextResponse.json({ error: '获取提醒列表失败' }, { status: 500 });
  }
}

// 获取项目提醒配置
async function getConfig(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = parseInt(searchParams.get('projectId') || '0');

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const config = await getProjectReminderConfig(projectId);

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Get reminder config error:', error);
    return NextResponse.json({ error: '获取提醒配置失败' }, { status: 500 });
  }
}

// 触发提醒检查（手动或定时任务调用）
async function triggerCheck(
  _request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const result = await checkAndSendMilestoneReminders();

    return NextResponse.json({
      success: true,
      message: `已发送 ${result.sent} 条提醒，跳过 ${result.skipped} 条`,
      ...result,
    });
  } catch (error) {
    console.error('Trigger reminder check error:', error);
    return NextResponse.json({ error: '触发提醒检查失败' }, { status: 500 });
  }
}

// 触发单个里程碑提醒
async function triggerSingle(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { milestoneId } = body;

    if (!milestoneId) {
      return NextResponse.json({ error: '缺少里程碑ID' }, { status: 400 });
    }

    const success = await triggerMilestoneReminder(milestoneId);

    if (success) {
      return NextResponse.json({ success: true, message: '提醒已发送' });
    } else {
      return NextResponse.json({ error: '里程碑不存在' }, { status: 404 });
    }
  } catch (error) {
    console.error('Trigger single reminder error:', error);
    return NextResponse.json({ error: '发送提醒失败' }, { status: 500 });
  }
}

// 更新提醒天数
async function updateReminderDays(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { milestoneId, reminderDays } = body;

    if (!milestoneId || reminderDays === undefined) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    await updateMilestoneReminderDays(milestoneId, reminderDays);

    return NextResponse.json({ success: true, message: '提醒配置已更新' });
  } catch (error) {
    console.error('Update reminder days error:', error);
    return NextResponse.json({ error: '更新提醒配置失败' }, { status: 500 });
  }
}

// 批量设置项目提醒天数
async function batchUpdateReminderDays(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { projectId, reminderDays } = body;

    if (!projectId || reminderDays === undefined) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const count = await batchSetProjectReminderDays(projectId, reminderDays);

    return NextResponse.json({
      success: true,
      message: `已更新 ${count} 个里程碑的提醒配置`,
    });
  } catch (error) {
    console.error('Batch update reminder days error:', error);
    return NextResponse.json({ error: '批量更新失败' }, { status: 500 });
  }
}

// 路由分发
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'config') {
    return withAuth(request, getConfig);
  }

  return withAuth(request, getReminders);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'check') {
    return withAuth(request, triggerCheck);
  }

  if (action === 'trigger') {
    return withAuth(request, triggerSingle);
  }

  if (action === 'update-days') {
    return withAuth(request, updateReminderDays);
  }

  if (action === 'batch-update-days') {
    return withAuth(request, batchUpdateReminderDays);
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

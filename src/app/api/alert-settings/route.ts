/**
 * 预警设置API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getAlertSetting,
  upsertAlertSetting,
  type UpdateAlertSettingParams,
} from '@/lib/tender-subscription/service';

// GET /api/alert-settings - 获取当前用户的预警设置
export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const setting = await getAlertSetting(session.user.id);

    if (!setting) {
      // 返回默认设置
      return NextResponse.json({
        userId: session.user.id,
        registerDays: 1,
        questionDays: 1,
        submissionDays: 3,
        openBidDays: 1,
        channels: ['system'],
        wechatWorkWebhook: null,
        dingtalkWebhook: null,
        email: null,
        quietHoursStart: null,
        quietHoursEnd: null,
        isEnabled: true,
      });
    }

    return NextResponse.json({
      ...setting,
      channels: setting.channels ? JSON.parse(setting.channels) : ['system'],
    });
  } catch (error) {
    console.error('获取预警设置失败:', error);
    return NextResponse.json({ error: '获取预警设置失败' }, { status: 500 });
  }
}

// PUT /api/alert-settings - 更新预警设置
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const params: UpdateAlertSettingParams = {
      registerDays: body.registerDays,
      questionDays: body.questionDays,
      submissionDays: body.submissionDays,
      openBidDays: body.openBidDays,
      channels: body.channels,
      wechatWorkWebhook: body.wechatWorkWebhook,
      dingtalkWebhook: body.dingtalkWebhook,
      email: body.email,
      quietHoursStart: body.quietHoursStart,
      quietHoursEnd: body.quietHoursEnd,
      isEnabled: body.isEnabled,
    };

    const setting = await upsertAlertSetting(session.user.id, params);

    return NextResponse.json({
      ...setting,
      channels: setting.channels ? JSON.parse(setting.channels) : ['system'],
    });
  } catch (error) {
    console.error('更新预警设置失败:', error);
    return NextResponse.json({ error: '更新预警设置失败' }, { status: 500 });
  }
}

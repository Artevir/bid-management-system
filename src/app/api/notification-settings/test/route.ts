/**
 * 通知测试API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { emailService, smsService, wechatService } from '@/lib/notification/service';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST /api/notification-settings/test - 发送测试消息
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { channel } = body;

    if (!channel) {
      return NextResponse.json({ error: '请选择测试渠道' }, { status: 400 });
    }

    // 获取用户详细信息
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const message = {
      title: '测试消息',
      content: '这是一条测试消息，用于验证消息推送功能是否正常工作。',
      type: 'info' as const,
    };

    let result = false;

    switch (channel) {
      case 'email':
        // 发送测试邮件
        if (user?.email) {
          result = await emailService.send(
            user.email,
            `【测试】${message.title}`,
            `<p>${message.content}</p><p>发送时间: ${new Date().toLocaleString('zh-CN')}</p>`
          );
        }
        break;

      case 'sms':
        // 发送测试短信
        if (user?.phone) {
          result = await smsService.sendAlert(user.phone, message.content);
        }
        break;

      case 'wechat':
        // 发送企业微信测试消息
        result = await wechatService.sendAlert('测试消息', message.content);
        break;

      case 'web':
        // Web推送测试 - 仅记录日志
        console.log('[Web Push Test]', message);
        result = true;
        break;

      default:
        return NextResponse.json({ error: '不支持的渠道' }, { status: 400 });
    }

    if (result) {
      return NextResponse.json({ success: true, message: '测试消息已发送' });
    } else {
      return NextResponse.json({ 
        error: '发送失败，请检查渠道配置是否正确' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('发送测试消息失败:', error);
    return NextResponse.json({ error: '发送测试消息失败' }, { status: 500 });
  }
}

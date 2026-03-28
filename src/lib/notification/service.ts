/**
 * 消息推送服务
 * 支持邮件、短信、企业微信等多渠道推送
 */

import { db } from '@/db';
import { reminderRules, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// ============================================
// 消息类型定义
// ============================================

export interface MessagePayload {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success';
  data?: Record<string, any>;
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'wechat' | 'web';
  enabled: boolean;
  config?: Record<string, any>;
}

// ============================================
// 邮件推送服务
// ============================================

export class EmailService {
  private config: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromEmail: string;
  };

  constructor() {
    this.config = {
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      fromEmail: process.env.FROM_EMAIL || 'noreply@example.com',
    };
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      // 实际项目中应该使用 nodemailer 或其他邮件服务
      console.log(`[Email] To: ${to}, Subject: ${subject}`);
      // TODO: 实现真实邮件发送
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    variables: Record<string, string>
  ): Promise<boolean> {
    const templates: Record<string, (vars: Record<string, string>) => { subject: string; html: string }> = {
      'deadline-reminder': (vars) => ({
        subject: `【投标提醒】${vars.projectName} - 截止时间提醒`,
        html: `
          <h2>投标截止时间提醒</h2>
          <p>项目名称：<strong>${vars.projectName}</strong></p>
          <p>截止时间：<strong>${vars.deadline}</strong></p>
          <p>剩余时间：${vars.remaining}</p>
          <p>请及时完成投标工作。</p>
        `,
      }),
      'qualification-expire': (vars) => ({
        subject: `【资质预警】${vars.qualificationName} 即将到期`,
        html: `
          <h2>资质证照到期提醒</h2>
          <p>资质名称：<strong>${vars.qualificationName}</strong></p>
          <p>到期日期：<strong>${vars.expireDate}</strong></p>
          <p>剩余天数：${vars.remainingDays} 天</p>
          <p>请及时办理续期。</p>
        `,
      }),
      'approval-required': (vars) => ({
        subject: `【审批通知】${vars.projectName} 等待审批`,
        html: `
          <h2>审批通知</h2>
          <p>项目名称：<strong>${vars.projectName}</strong></p>
          <p>审批类型：${vars.approvalType}</p>
          <p>提交人：${vars.submitter}</p>
          <p>请及时处理审批。</p>
        `,
      }),
    };

    const template = templates[templateName];
    if (!template) {
      console.error(`Template not found: ${templateName}`);
      return false;
    }

    const { subject, html } = template(variables);
    return this.send(to, subject, html);
  }
}

// ============================================
// 短信推送服务
// ============================================

export class SmsService {
  private config: {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
  };

  constructor() {
    this.config = {
      accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
      signName: process.env.SMS_SIGN_NAME || '',
      templateCode: process.env.SMS_TEMPLATE_CODE || '',
    };
  }

  async send(phone: string, content: string): Promise<boolean> {
    try {
      // 实际项目中应该使用阿里云短信、腾讯云短信等服务
      console.log(`[SMS] To: ${phone}, Content: ${content}`);
      // TODO: 实现真实短信发送
      return true;
    } catch (error) {
      console.error('SMS send error:', error);
      return false;
    }
  }

  async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    return this.send(phone, `您的验证码是：${code}，5分钟内有效。`);
  }

  async sendAlert(phone: string, message: string): Promise<boolean> {
    return this.send(phone, `【投标系统提醒】${message}`);
  }
}

// ============================================
// 企业微信推送服务
// ============================================

export class WechatWorkService {
  private config: {
    webhookUrl: string;
    corpId: string;
    agentId: string;
    secret: string;
  };

  constructor() {
    this.config = {
      webhookUrl: process.env.WECHAT_WEBHOOK_URL || '',
      corpId: process.env.WECHAT_CORP_ID || '',
      agentId: process.env.WECHAT_AGENT_ID || '',
      secret: process.env.WECHAT_SECRET || '',
    };
  }

  async sendMarkdown(content: string): Promise<boolean> {
    try {
      if (!this.config.webhookUrl) {
        console.log('[WechatWork] Webhook URL not configured');
        return false;
      }

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { content },
        }),
      });

      const result = await response.json();
      return result.errcode === 0;
    } catch (error) {
      console.error('WechatWork send error:', error);
      return false;
    }
  }

  async sendCard(title: string, description: string, url?: string): Promise<boolean> {
    const content = url
      ? `**${title}**\n>${description}\n[点击查看详情](${url})`
      : `**${title}**\n>${description}`;
    return this.sendMarkdown(content);
  }

  async sendAlert(title: string, message: string): Promise<boolean> {
    return this.sendMarkdown(`## ⚠️ ${title}\n> ${message}\n\n> 时间：${new Date().toLocaleString('zh-CN')}`);
  }
}

// ============================================
// 统一消息推送服务
// ============================================

export class NotificationService {
  private emailService: EmailService;
  private smsService: SmsService;
  private wechatService: WechatWorkService;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SmsService();
    this.wechatService = new WechatWorkService();
  }

  async send(
    userId: number,
    message: MessagePayload,
    channels: NotificationChannel[]
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // 获取用户信息
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return results;
    }

    for (const channel of channels) {
      if (!channel.enabled) continue;

      switch (channel.type) {
        case 'email':
          if (user.email) {
            results.email = await this.emailService.send(
              user.email,
              message.title,
              `<p>${message.content}</p>`
            );
          }
          break;

        case 'sms':
          if (user.phone) {
            results.sms = await this.smsService.sendAlert(user.phone, message.content);
          }
          break;

        case 'wechat':
          results.wechat = await this.wechatService.sendAlert(message.title, message.content);
          break;

        case 'web':
          // Web 推送通常由前端处理，这里只记录
          results.web = true;
          break;
      }
    }

    return results;
  }

  async broadcast(
    userIds: number[],
    message: MessagePayload,
    channels: NotificationChannel[]
  ): Promise<void> {
    const promises = userIds.map((userId) => this.send(userId, message, channels));
    await Promise.allSettled(promises);
  }

  async sendToRole(
    roleCode: string,
    message: MessagePayload,
    channels: NotificationChannel[]
  ): Promise<void> {
    // 查找指定角色的所有用户
    // TODO: 实现角色用户查询
    console.log(`[Notification] Send to role: ${roleCode}`);
  }
}

// 导出单例
export const notificationService = new NotificationService();
export const emailService = new EmailService();
export const smsService = new SmsService();
export const wechatService = new WechatWorkService();

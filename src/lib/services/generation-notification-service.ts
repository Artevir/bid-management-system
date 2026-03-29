/**
 * 文档生成进度通知服务
 * 支持邮件、企业微信、系统内通知
 */

import { db } from '@/db';
import { bidDocuments, documentGenerationHistories as _documentGenerationHistories, users, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { emailService, wechatService } from '@/lib/notification/service';
import { GenerationProgress } from './generation-progress-service-v2';

// ============================================
// 类型定义
// ============================================

export interface NotificationConfig {
  email: boolean;
  wechat: boolean;
  system: boolean;
  onComplete: boolean;
  onError: boolean;
  onProgress: boolean; // 每完成一定比例通知
  progressInterval: number; // 进度通知间隔（百分比）
}

export interface NotificationPayload {
  documentId: number;
  documentName: string;
  projectName: string;
  status: 'completed' | 'failed' | 'progress';
  progress?: number;
  wordCount?: number;
  chapterCount?: number;
  duration?: number;
  error?: string;
  recipientEmail?: string;
  recipientName?: string;
}

// ============================================
// 默认通知配置
// ============================================

const defaultConfig: NotificationConfig = {
  email: true,
  wechat: false,
  system: true,
  onComplete: true,
  onError: true,
  onProgress: false,
  progressInterval: 25, // 每25%通知一次
};

// ============================================
// 通知服务
// ============================================

export const generationNotificationService = {
  /**
   * 发送生成完成通知
   */
  async sendCompletionNotification(
    documentId: number,
    userId: number,
    progress: GenerationProgress
  ): Promise<void> {
    // 获取用户和文档信息
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [document] = await db.select().from(bidDocuments).where(eq(bidDocuments.id, documentId)).limit(1);

    if (!user || !document) {
      console.error('[Notification] User or document not found');
      return;
    }

    // 获取项目信息
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, document.projectId))
      .limit(1);

    const payload: NotificationPayload = {
      documentId,
      documentName: document.name,
      projectName: project?.name || '未知项目',
      status: 'completed',
      progress: 100,
      wordCount: progress.statistics.totalWordCount,
      chapterCount: progress.statistics.generatedChapters,
      duration: progress.statistics.elapsedTime,
      recipientEmail: user.email,
      recipientName: user.realName || user.username,
    };

    // 发送邮件通知
    if (user.email) {
      await this.sendEmailNotification(payload, 'completed');
    }

    // 发送企业微信通知
    await this.sendWechatNotification(payload, 'completed');

    // 发送系统内通知
    await this.sendSystemNotification(userId, payload, 'completed');
  },

  /**
   * 发送生成失败通知
   */
  async sendErrorNotification(
    documentId: number,
    userId: number,
    error: string
  ): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [document] = await db.select().from(bidDocuments).where(eq(bidDocuments.id, documentId)).limit(1);

    if (!user || !document) return;

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, document.projectId))
      .limit(1);

    const payload: NotificationPayload = {
      documentId,
      documentName: document.name,
      projectName: project?.name || '未知项目',
      status: 'failed',
      error,
      recipientEmail: user.email,
      recipientName: user.realName || user.username,
    };

    if (user.email) {
      await this.sendEmailNotification(payload, 'failed');
    }

    await this.sendWechatNotification(payload, 'failed');
    await this.sendSystemNotification(userId, payload, 'failed');
  },

  /**
   * 发送进度通知
   */
  async sendProgressNotification(
    documentId: number,
    userId: number,
    progress: GenerationProgress,
    lastNotifiedProgress: number
  ): Promise<number> {
    const config = defaultConfig;
    
    // 检查是否需要发送进度通知
    const progressDiff = progress.percentage - lastNotifiedProgress;
    if (progressDiff < config.progressInterval) {
      return lastNotifiedProgress;
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [document] = await db.select().from(bidDocuments).where(eq(bidDocuments.id, documentId)).limit(1);

    if (!user || !document) return lastNotifiedProgress;

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, document.projectId))
      .limit(1);

    const payload: NotificationPayload = {
      documentId,
      documentName: document.name,
      projectName: project?.name || '未知项目',
      status: 'progress',
      progress: progress.percentage,
      wordCount: progress.statistics.totalWordCount,
      chapterCount: progress.statistics.generatedChapters,
      duration: progress.statistics.elapsedTime,
      recipientEmail: user.email,
      recipientName: user.realName || user.username,
    };

    // 进度通知只发系统内通知，不发邮件
    await this.sendSystemNotification(userId, payload, 'progress');

    return progress.percentage;
  },

  /**
   * 发送邮件通知
   */
  async sendEmailNotification(
    payload: NotificationPayload,
    type: 'completed' | 'failed' | 'progress'
  ): Promise<boolean> {
    if (!payload.recipientEmail) return false;

    const templates = {
      completed: {
        subject: `【文档生成完成】${payload.documentName}`,
        html: this.generateCompletionEmailHtml(payload),
      },
      failed: {
        subject: `【文档生成失败】${payload.documentName}`,
        html: this.generateErrorEmailHtml(payload),
      },
      progress: {
        subject: `【文档生成进度】${payload.documentName} - ${payload.progress}%`,
        html: this.generateProgressEmailHtml(payload),
      },
    };

    const template = templates[type];
    return emailService.send(payload.recipientEmail, template.subject, template.html);
  },

  /**
   * 发送企业微信通知
   */
  async sendWechatNotification(
    payload: NotificationPayload,
    type: 'completed' | 'failed' | 'progress'
  ): Promise<boolean> {
    const title = {
      completed: '文档生成完成',
      failed: '文档生成失败',
      progress: '文档生成进度',
    }[type];

    const content = {
      completed: `项目：${payload.projectName}\n文档：${payload.documentName}\n字数：${payload.wordCount?.toLocaleString() || 0}\n章节：${payload.chapterCount}章`,
      failed: `项目：${payload.projectName}\n文档：${payload.documentName}\n错误：${payload.error || '未知错误'}`,
      progress: `项目：${payload.projectName}\n进度：${payload.progress}%\n已完成：${payload.chapterCount}章`,
    }[type];

    return wechatService.sendMarkdown(`## ${title}\n\n${content}\n\n> 时间：${new Date().toLocaleString('zh-CN')}`);
  },

  /**
   * 发送系统内通知
   */
  async sendSystemNotification(
    userId: number,
    payload: NotificationPayload,
    type: 'completed' | 'failed' | 'progress'
  ): Promise<void> {
    // 使用现有的通知服务发送系统内通知
    const { notificationService } = await import('@/lib/notification/service');

    const titles = {
      completed: '文档生成完成',
      failed: '文档生成失败',
      progress: '文档生成进度更新',
    };

    const contents = {
      completed: `${payload.documentName} 已生成完成，共 ${payload.chapterCount} 章，${payload.wordCount?.toLocaleString() || 0} 字`,
      failed: `${payload.documentName} 生成失败：${payload.error || '未知错误'}`,
      progress: `${payload.documentName} 生成进度 ${payload.progress}%，已完成 ${payload.chapterCount} 章`,
    };

    await notificationService.send(
      userId,
      {
        title: titles[type],
        content: contents[type],
        type: type === 'failed' ? 'error' : 'success',
        data: {
          documentId: payload.documentId,
          projectName: payload.projectName,
        },
      },
      [{ type: 'web', enabled: true }]
    );
  },

  /**
   * 生成完成邮件 HTML
   */
  generateCompletionEmailHtml(payload: NotificationPayload): string {
    const duration = payload.duration ? this.formatDuration(payload.duration) : '-';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat-item { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
    .stat-label { font-size: 12px; color: #666; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 文档生成完成</h1>
    </div>
    <div class="content">
      <p>尊敬的 ${payload.recipientName || '用户'}：</p>
      <p>您的投标文档 <strong>${payload.documentName}</strong> 已成功生成！</p>
      
      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">${payload.chapterCount || 0}</div>
          <div class="stat-label">章节</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${payload.wordCount?.toLocaleString() || 0}</div>
          <div class="stat-label">字数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${duration}</div>
          <div class="stat-label">耗时</div>
        </div>
      </div>
      
      <p>项目：${payload.projectName}</p>
      
      <p style="text-align: center;">
        <a href="${process.env.COZE_PROJECT_DOMAIN_DEFAULT || ''}/bid/${payload.documentId}" class="button">查看文档</a>
      </p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿回复。</p>
    </div>
  </div>
</body>
</html>
    `;
  },

  /**
   * 生成错误邮件 HTML
   */
  generateErrorEmailHtml(payload: NotificationPayload): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .error-box { background: #fff; border-left: 4px solid #e74c3c; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ 文档生成失败</h1>
    </div>
    <div class="content">
      <p>尊敬的 ${payload.recipientName || '用户'}：</p>
      <p>您的投标文档 <strong>${payload.documentName}</strong> 生成过程中遇到错误。</p>
      
      <div class="error-box">
        <strong>错误信息：</strong><br>
        ${payload.error || '未知错误'}
      </div>
      
      <p>项目：${payload.projectName}</p>
      
      <p>您可以尝试：</p>
      <ul>
        <li>检查网络连接后重试</li>
        <li>使用断点续传功能继续生成</li>
        <li>联系技术支持</li>
      </ul>
      
      <p style="text-align: center;">
        <a href="${process.env.COZE_PROJECT_DOMAIN_DEFAULT || ''}/bid/${payload.documentId}" class="button">查看详情</a>
      </p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿回复。</p>
    </div>
  </div>
</body>
</html>
    `;
  },

  /**
   * 生成进度邮件 HTML
   */
  generateProgressEmailHtml(payload: NotificationPayload): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .progress-bar { background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 20px 0; }
    .progress-fill { background: linear-gradient(90deg, #3498db, #667eea); height: 20px; width: ${payload.progress}%; transition: width 0.3s; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 文档生成进度</h1>
    </div>
    <div class="content">
      <p>尊敬的 ${payload.recipientName || '用户'}：</p>
      <p>您的投标文档 <strong>${payload.documentName}</strong> 正在生成中...</p>
      
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      
      <p style="text-align: center;">
        已完成：<strong>${payload.progress}%</strong>（${payload.chapterCount} 章）
      </p>
      
      <p>项目：${payload.projectName}</p>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿回复。</p>
    </div>
  </div>
</body>
</html>
    `;
  },

  /**
   * 格式化持续时间
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  },
};

export default generationNotificationService;

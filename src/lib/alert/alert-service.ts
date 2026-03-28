/**
 * 预警提醒系统
 * 支持多种预警类型的创建、发送和管理
 */

import { db } from '@/db/index';
import { cache } from '@/lib/cache';
import { sendNotificationToUser, NotificationType } from '@/lib/realtime/websocket-server';

// ============================================
// 预警类型
// ============================================

export enum AlertType {
  DEADLINE_WARNING = 'deadline_warning', // 截止日期提醒
  REVIEW_TIMEOUT = 'review_timeout', // 审核超时
  DOCUMENT_MISSING = 'document_missing', // 文档缺失
  APPROVAL_NEEDED = 'approval_needed', // 需要审批
  CONTRACT_EXPIRING = 'contract_expiring', // 合同即将到期
  PAYMENT_OVERDUE = 'payment_overdue', // 付款逾期
  SYSTEM_ERROR = 'system_error', // 系统错误
  CUSTOM = 'custom', // 自定义
}

// ============================================
// 预警级别
// ============================================

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// ============================================
// 预警状态
// ============================================

export enum AlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

// ============================================
// 预警接口
// ============================================

export interface Alert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  title: string;
  message: string;
  userId?: string; // 接收用户
  companyId?: string; // 接收公司
  resourceType?: string; // 关联资源类型
  resourceId?: string; // 关联资源ID
  metadata?: Record<string, any>; // 额外信息
  status: AlertStatus;
  scheduledAt?: Date; // 计划发送时间
  sentAt?: Date; // 实际发送时间
  acknowledgedAt?: Date; // 确认时间
  resolvedAt?: Date; // 解决时间
  createdAt: Date;
  expiresAt?: Date; // 过期时间
}

// ============================================
// 预警配置接口
// ============================================

export interface AlertConfig {
  type: AlertType;
  level: AlertLevel;
  enabled: boolean;
  channels: Array<'notification' | 'email' | 'sms' | 'wechat' | 'dingtalk'>;
  template?: string;
  retryTimes?: number;
  retryInterval?: number; // 重试间隔（秒）
}

// ============================================
// 预警服务类
// ============================================

export class AlertService {
  private static alerts: Map<string, Alert> = new Map();
  private static configs: Map<AlertType, AlertConfig> = new Map();

  /**
   * 初始化预警配置
   */
  static async initialize(): Promise<void> {
    console.log('[Alert] 初始化预警系统');

    // 注册默认预警配置
    this.registerDefaultConfigs();
  }

  /**
   * 注册默认预警配置
   */
  private static registerDefaultConfigs(): void {
    const defaultConfigs: Array<{ type: AlertType; config: Partial<AlertConfig> }> = [
      {
        type: AlertType.DEADLINE_WARNING,
        config: {
          level: AlertLevel.WARNING,
          enabled: true,
          channels: ['notification', 'email'],
          retryTimes: 3,
          retryInterval: 300,
        },
      },
      {
        type: AlertType.REVIEW_TIMEOUT,
        config: {
          level: AlertLevel.ERROR,
          enabled: true,
          channels: ['notification', 'email', 'dingtalk'],
          retryTimes: 5,
          retryInterval: 600,
        },
      },
      {
        type: AlertType.DOCUMENT_MISSING,
        config: {
          level: AlertLevel.WARNING,
          enabled: true,
          channels: ['notification'],
        },
      },
      {
        type: AlertType.APPROVAL_NEEDED,
        config: {
          level: AlertLevel.INFO,
          enabled: true,
          channels: ['notification'],
        },
      },
      {
        type: AlertType.CONTRACT_EXPIRING,
        config: {
          level: AlertLevel.WARNING,
          enabled: true,
          channels: ['notification', 'email'],
        },
      },
      {
        type: AlertType.PAYMENT_OVERDUE,
        config: {
          level: AlertLevel.ERROR,
          enabled: true,
          channels: ['notification', 'email', 'sms'],
        },
      },
      {
        type: AlertType.SYSTEM_ERROR,
        config: {
          level: AlertLevel.CRITICAL,
          enabled: true,
          channels: ['notification', 'email', 'dingtalk'],
          retryTimes: 5,
          retryInterval: 60,
        },
      },
    ];

    for (const { type, config } of defaultConfigs) {
      this.configs.set(type, {
        type,
        ...config,
      } as AlertConfig);
    }
  }

  /**
   * 创建预警
   */
  static async createAlert(alert: Omit<Alert, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newAlert: Alert = {
      ...alert,
      id: alertId,
      status: AlertStatus.PENDING,
      createdAt: new Date(),
    };

    this.alerts.set(alertId, newAlert);

    // 缓存预警
    await cache.set(`alert:${alertId}`, JSON.stringify(newAlert), 86400);

    // 发送预警
    await this.sendAlert(alertId);

    return alertId;
  }

  /**
   * 发送预警
   */
  private static async sendAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    const config = this.configs.get(alert.type);
    if (!config || !config.enabled) {
      return;
    }

    console.log(`[Alert] 发送预警: ${alert.title}`);

    try {
      // 通过通知渠道发送
      if (config.channels.includes('notification')) {
        if (alert.userId) {
          await sendNotificationToUser(alert.userId, {
            type: NotificationType.SYSTEM_MESSAGE,
            title: alert.title,
            message: alert.message,
            priority: this.mapLevelToPriority(alert.level),
            data: alert.metadata,
          });
        } else if (alert.companyId) {
          await sendNotificationToUser(alert.companyId, {
            type: NotificationType.SYSTEM_MESSAGE,
            title: alert.title,
            message: alert.message,
            priority: this.mapLevelToPriority(alert.level),
            data: alert.metadata,
          });
        }
      }

      // TODO: 通过其他渠道发送（邮件、短信、钉钉等）

      // 更新预警状态
      alert.status = AlertStatus.SENT;
      alert.sentAt = new Date();
      await cache.set(`alert:${alertId}`, JSON.stringify(alert), 86400);

      console.log(`[Alert] 预警发送成功: ${alertId}`);
    } catch (error) {
      console.error(`[Alert] 预警发送失败: ${alertId}`, error);

      // TODO: 重试逻辑
    }
  }

  /**
   * 确认预警
   */
  static async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    await cache.set(`alert:${alertId}`, JSON.stringify(alert), 86400);

    console.log(`[Alert] 预警已确认: ${alertId} by ${userId}`);
    return true;
  }

  /**
   * 解决预警
   */
  static async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    await cache.set(`alert:${alertId}`, JSON.stringify(alert), 86400);

    console.log(`[Alert] 预警已解决: ${alertId}`);
    return true;
  }

  /**
   * 忽略预警
   */
  static async dismissAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = AlertStatus.DISMISSED;
    await cache.set(`alert:${alertId}`, JSON.stringify(alert), 86400);

    console.log(`[Alert] 预警已忽略: ${alertId}`);
    return true;
  }

  /**
   * 获取预警列表
   */
  static async getAlerts(filters: {
    userId?: string;
    type?: AlertType;
    level?: AlertLevel;
    status?: AlertStatus;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    // 过滤
    if (filters.userId) {
      alerts = alerts.filter(a => a.userId === filters.userId);
    }
    if (filters.type) {
      alerts = alerts.filter(a => a.type === filters.type);
    }
    if (filters.level) {
      alerts = alerts.filter(a => a.level === filters.level);
    }
    if (filters.status) {
      alerts = alerts.filter(a => a.status === filters.status);
    }
    if (filters.startDate) {
      alerts = alerts.filter(a => a.createdAt >= filters.startDate!);
    }
    if (filters.endDate) {
      alerts = alerts.filter(a => a.createdAt <= filters.endDate!);
    }

    // 按时间倒序
    alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return alerts;
  }

  /**
   * 映射预警级别到通知优先级
   */
  private static mapLevelToPriority(level: AlertLevel): 'low' | 'medium' | 'high' | 'urgent' {
    switch (level) {
      case AlertLevel.INFO:
        return 'low';
      case AlertLevel.WARNING:
        return 'medium';
      case AlertLevel.ERROR:
        return 'high';
      case AlertLevel.CRITICAL:
        return 'urgent';
      default:
        return 'low';
    }
  }

  /**
   * 批量创建截止日期提醒
   */
  static async createDeadlineReminders(): Promise<number> {
    // TODO: 查询即将到期的项目，批量创建提醒
    console.log('[Alert] 批量创建截止日期提醒');
    return 0;
  }

  /**
   * 清理过期预警
   */
  static async cleanupExpiredAlerts(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.expiresAt && alert.expiresAt < now) {
        this.alerts.delete(alertId);
        await cache.del(`alert:${alertId}`);
        cleaned++;
      }
    }

    console.log(`[Alert] 清理了 ${cleaned} 个过期预警`);
    return cleaned;
  }
}

// ============================================
// 导出
// ============================================

export default AlertService;

/**
 * 招标信息订阅服务
 * 提供订阅规则管理、预警设置、预警记录等功能
 */

import { db } from '@/db';
import {
  tenderSubscriptions,
  alertSettings,
  tenderAlerts,
  tenderInfos,
  users as _users,
} from '@/db/schema';
import { eq, and, desc, sql, inArray, or as _or, like as _like, gte as _gte, lte, isNull as _isNull } from 'drizzle-orm';
import type {
  TenderSubscription,
  NewTenderSubscription,
  AlertSetting,
  NewAlertSetting,
  TenderAlert,
  NewTenderAlert as _NewTenderAlert,
  AlertType,
  AlertChannel,
} from '@/db/schema';

// 重新导出类型供其他模块使用
export type { AlertType, AlertChannel } from '@/db/schema';

// ============================================
// 类型定义
// ============================================

export interface SubscriptionFilters {
  userId?: number;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateSubscriptionParams {
  name: string;
  userId: number;
  industries?: string[];
  regions?: string[];
  procurementMethods?: string[];
  keywords: string[];
  budgetMin?: string;
  budgetMax?: string;
  projectTypes?: string[];
  tenderOrganizations?: string[];
  isActive?: boolean;
}

export interface UpdateSubscriptionParams {
  name?: string;
  industries?: string[];
  regions?: string[];
  procurementMethods?: string[];
  keywords?: string[];
  budgetMin?: string;
  budgetMax?: string;
  projectTypes?: string[];
  tenderOrganizations?: string[];
  isActive?: boolean;
}

export interface CreateAlertSettingParams {
  userId: number;
  registerDays?: number;
  questionDays?: number;
  submissionDays?: number;
  openBidDays?: number;
  channels?: AlertChannel[];
  wechatWorkWebhook?: string;
  dingtalkWebhook?: string;
  email?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  isEnabled?: boolean;
}

export interface UpdateAlertSettingParams {
  registerDays?: number;
  questionDays?: number;
  submissionDays?: number;
  openBidDays?: number;
  channels?: AlertChannel[];
  wechatWorkWebhook?: string;
  dingtalkWebhook?: string;
  email?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  isEnabled?: boolean;
}

export interface CreateAlertParams {
  tenderInfoId: number;
  subscriptionId?: number;
  userId: number;
  alertType: AlertType;
  alertTitle: string;
  alertMessage: string;
  targetTime: Date;
  scheduledTime: Date;
  channel?: AlertChannel;
}

export interface TenderAlertWithTender extends TenderAlert {
  tenderInfo?: typeof tenderInfos.$inferSelect;
}

// ============================================
// 订阅规则管理
// ============================================

/**
 * 创建订阅规则
 */
export async function createSubscription(data: CreateSubscriptionParams): Promise<TenderSubscription> {
  // 校验：关键词不能为空
  if (!data.keywords || data.keywords.length === 0) {
    throw new Error('关键词不能为空');
  }

  // 校验：预算区间
  if (data.budgetMin && data.budgetMax) {
    const min = parseFloat(data.budgetMin.replace(/[^\d.]/g, ''));
    const max = parseFloat(data.budgetMax.replace(/[^\d.]/g, ''));
    if (!isNaN(min) && !isNaN(max) && min > max) {
      throw new Error('预算最小值不能大于最大值');
    }
  }

  // 检查重复订阅
  const existing = await checkDuplicateSubscription(data.userId, {
    industries: data.industries,
    regions: data.regions,
    keywords: data.keywords,
  });

  if (existing) {
    throw new Error('已存在相同的订阅规则');
  }

  const [subscription] = await db
    .insert(tenderSubscriptions)
    .values({
      name: data.name,
      userId: data.userId,
      industries: data.industries ? JSON.stringify(data.industries) : null,
      regions: data.regions ? JSON.stringify(data.regions) : null,
      procurementMethods: data.procurementMethods ? JSON.stringify(data.procurementMethods) : null,
      keywords: JSON.stringify(data.keywords),
      budgetMin: data.budgetMin || null,
      budgetMax: data.budgetMax || null,
      projectTypes: data.projectTypes ? JSON.stringify(data.projectTypes) : null,
      tenderOrganizations: data.tenderOrganizations ? JSON.stringify(data.tenderOrganizations) : null,
      isActive: data.isActive ?? true,
    })
    .returning();

  return subscription;
}

/**
 * 获取订阅列表
 */
export async function getSubscriptions(filters: SubscriptionFilters): Promise<{
  data: TenderSubscription[];
  total: number;
}> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters.userId) {
    conditions.push(eq(tenderSubscriptions.userId, filters.userId));
  }
  if (filters.isActive !== undefined) {
    conditions.push(eq(tenderSubscriptions.isActive, filters.isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tenderSubscriptions)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(tenderSubscriptions)
    .where(whereClause)
    .orderBy(desc(tenderSubscriptions.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

/**
 * 获取订阅详情
 */
export async function getSubscriptionById(id: number): Promise<TenderSubscription | null> {
  const [subscription] = await db
    .select()
    .from(tenderSubscriptions)
    .where(eq(tenderSubscriptions.id, id))
    .limit(1);

  return subscription || null;
}

/**
 * 更新订阅规则
 */
export async function updateSubscription(
  id: number,
  data: UpdateSubscriptionParams
): Promise<TenderSubscription> {
  const updateData: Partial<NewTenderSubscription> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.industries !== undefined) {
    updateData.industries = data.industries ? JSON.stringify(data.industries) : null;
  }
  if (data.regions !== undefined) {
    updateData.regions = data.regions ? JSON.stringify(data.regions) : null;
  }
  if (data.procurementMethods !== undefined) {
    updateData.procurementMethods = data.procurementMethods ? JSON.stringify(data.procurementMethods) : null;
  }
  if (data.keywords !== undefined) {
    if (data.keywords.length === 0) {
      throw new Error('关键词不能为空');
    }
    updateData.keywords = JSON.stringify(data.keywords);
  }
  if (data.budgetMin !== undefined) updateData.budgetMin = data.budgetMin || null;
  if (data.budgetMax !== undefined) updateData.budgetMax = data.budgetMax || null;
  if (data.projectTypes !== undefined) {
    updateData.projectTypes = data.projectTypes ? JSON.stringify(data.projectTypes) : null;
  }
  if (data.tenderOrganizations !== undefined) {
    updateData.tenderOrganizations = data.tenderOrganizations ? JSON.stringify(data.tenderOrganizations) : null;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [subscription] = await db
    .update(tenderSubscriptions)
    .set(updateData)
    .where(eq(tenderSubscriptions.id, id))
    .returning();

  return subscription;
}

/**
 * 删除订阅规则
 */
export async function deleteSubscription(id: number): Promise<void> {
  await db.delete(tenderSubscriptions).where(eq(tenderSubscriptions.id, id));
}

/**
 * 检查重复订阅
 */
async function checkDuplicateSubscription(
  userId: number,
  params: {
    industries?: string[];
    regions?: string[];
    keywords: string[];
  }
): Promise<boolean> {
  const subscriptions = await db
    .select()
    .from(tenderSubscriptions)
    .where(eq(tenderSubscriptions.userId, userId));

  for (const sub of subscriptions) {
    const subKeywords = JSON.parse(sub.keywords || '[]');
    const subIndustries = JSON.parse(sub.industries || '[]');
    const subRegions = JSON.parse(sub.regions || '[]');

    // 检查关键词是否完全相同
    const keywordsMatch =
      subKeywords.length === params.keywords.length &&
      subKeywords.every((k: string) => params.keywords.includes(k));

    if (keywordsMatch) {
      // 检查行业和地区是否相同
      const industriesMatch =
        (!params.industries || params.industries.length === 0) &&
        subIndustries.length === 0 ||
        (params.industries &&
          subIndustries.length === params.industries.length &&
          subIndustries.every((i: string) => params.industries!.includes(i)));

      const regionsMatch =
        (!params.regions || params.regions.length === 0) &&
        subRegions.length === 0 ||
        (params.regions &&
          subRegions.length === params.regions.length &&
          subRegions.every((r: string) => params.regions!.includes(r)));

      if (industriesMatch && regionsMatch) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 匹配招标信息与订阅规则
 */
export async function matchTenderToSubscriptions(tenderInfo: typeof tenderInfos.$inferSelect): Promise<TenderSubscription[]> {
  const allSubscriptions = await db
    .select()
    .from(tenderSubscriptions)
    .where(eq(tenderSubscriptions.isActive, true));

  const matchedSubscriptions: TenderSubscription[] = [];

  for (const subscription of allSubscriptions) {
    const isMatch = await checkTenderMatch(tenderInfo, subscription);
    if (isMatch) {
      matchedSubscriptions.push(subscription);

      // 更新匹配计数
      await db
        .update(tenderSubscriptions)
        .set({
          matchCount: sql`${tenderSubscriptions.matchCount} + 1`,
          lastMatchAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tenderSubscriptions.id, subscription.id));
    }
  }

  return matchedSubscriptions;
}

/**
 * 检查招标信息是否匹配订阅规则
 */
async function checkTenderMatch(
  tenderInfo: typeof tenderInfos.$inferSelect,
  subscription: TenderSubscription
): Promise<boolean> {
  // 检查关键词匹配
  const keywords = JSON.parse(subscription.keywords || '[]');
  if (keywords.length > 0) {
    const titleMatch = keywords.some((k: string) =>
      tenderInfo.title?.toLowerCase().includes(k.toLowerCase())
    );
    const contentMatch = keywords.some((k: string) =>
      tenderInfo.content?.toLowerCase().includes(k.toLowerCase()) ||
      tenderInfo.summary?.toLowerCase().includes(k.toLowerCase())
    );
    if (!titleMatch && !contentMatch) {
      return false;
    }
  }

  // 检查行业匹配
  const industries = JSON.parse(subscription.industries || '[]');
  if (industries.length > 0 && tenderInfo.industry) {
    if (!industries.includes(tenderInfo.industry)) {
      return false;
    }
  }

  // 检查地区匹配
  const regions = JSON.parse(subscription.regions || '[]');
  if (regions.length > 0 && tenderInfo.region) {
    if (!regions.some((r: string) => tenderInfo.region?.includes(r))) {
      return false;
    }
  }

  // 检查采购方式匹配
  const procurementMethods = JSON.parse(subscription.procurementMethods || '[]');
  if (procurementMethods.length > 0 && tenderInfo.tenderType) {
    if (!procurementMethods.includes(tenderInfo.tenderType)) {
      return false;
    }
  }

  // 检查预算区间匹配
  if (subscription.budgetMin || subscription.budgetMax) {
    const budget = parseFloat(tenderInfo.budget?.replace(/[^\d.]/g, '') || '0');
    if (subscription.budgetMin) {
      const min = parseFloat(subscription.budgetMin.replace(/[^\d.]/g, ''));
      if (!isNaN(min) && budget < min) {
        return false;
      }
    }
    if (subscription.budgetMax) {
      const max = parseFloat(subscription.budgetMax.replace(/[^\d.]/g, ''));
      if (!isNaN(max) && budget > max) {
        return false;
      }
    }
  }

  // 检查招标单位匹配
  const tenderOrganizations = JSON.parse(subscription.tenderOrganizations || '[]');
  if (tenderOrganizations.length > 0 && tenderInfo.tenderOrganization) {
    if (!tenderOrganizations.some((o: string) =>
      tenderInfo.tenderOrganization?.includes(o)
    )) {
      return false;
    }
  }

  return true;
}

// ============================================
// 预警设置管理
// ============================================

/**
 * 获取用户预警设置
 */
export async function getAlertSetting(userId: number): Promise<AlertSetting | null> {
  const [setting] = await db
    .select()
    .from(alertSettings)
    .where(eq(alertSettings.userId, userId))
    .limit(1);

  return setting || null;
}

/**
 * 创建或更新预警设置
 */
export async function upsertAlertSetting(
  userId: number,
  data: UpdateAlertSettingParams
): Promise<AlertSetting> {
  const existing = await getAlertSetting(userId);

  const settingData: Partial<NewAlertSetting> = {
    updatedAt: new Date(),
  };

  if (data.registerDays !== undefined) settingData.registerDays = data.registerDays;
  if (data.questionDays !== undefined) settingData.questionDays = data.questionDays;
  if (data.submissionDays !== undefined) settingData.submissionDays = data.submissionDays;
  if (data.openBidDays !== undefined) settingData.openBidDays = data.openBidDays;
  if (data.channels !== undefined) settingData.channels = JSON.stringify(data.channels);
  if (data.wechatWorkWebhook !== undefined) settingData.wechatWorkWebhook = data.wechatWorkWebhook;
  if (data.dingtalkWebhook !== undefined) settingData.dingtalkWebhook = data.dingtalkWebhook;
  if (data.email !== undefined) settingData.email = data.email;
  if (data.quietHoursStart !== undefined) settingData.quietHoursStart = data.quietHoursStart;
  if (data.quietHoursEnd !== undefined) settingData.quietHoursEnd = data.quietHoursEnd;
  if (data.isEnabled !== undefined) settingData.isEnabled = data.isEnabled;

  if (existing) {
    const [setting] = await db
      .update(alertSettings)
      .set(settingData)
      .where(eq(alertSettings.userId, userId))
      .returning();
    return setting;
  } else {
    const [setting] = await db
      .insert(alertSettings)
      .values({
        userId,
        registerDays: data.registerDays ?? 1,
        questionDays: data.questionDays ?? 1,
        submissionDays: data.submissionDays ?? 3,
        openBidDays: data.openBidDays ?? 1,
        channels: JSON.stringify(data.channels ?? ['system']),
        wechatWorkWebhook: data.wechatWorkWebhook || null,
        dingtalkWebhook: data.dingtalkWebhook || null,
        email: data.email || null,
        quietHoursStart: data.quietHoursStart || null,
        quietHoursEnd: data.quietHoursEnd || null,
        isEnabled: data.isEnabled ?? true,
      })
      .returning();
    return setting;
  }
}

// ============================================
// 预警记录管理
// ============================================

/**
 * 创建预警记录
 */
export async function createAlert(data: CreateAlertParams): Promise<TenderAlert> {
  const [alert] = await db
    .insert(tenderAlerts)
    .values({
      tenderInfoId: data.tenderInfoId,
      subscriptionId: data.subscriptionId || null,
      userId: data.userId,
      alertType: data.alertType,
      alertTitle: data.alertTitle,
      alertMessage: data.alertMessage,
      targetTime: data.targetTime,
      scheduledTime: data.scheduledTime,
      channel: data.channel || 'system',
      status: 'pending',
    })
    .returning();

  return alert;
}

/**
 * 获取用户预警列表
 */
export async function getAlerts(filters: {
  userId?: number;
  status?: 'pending' | 'sent' | 'read' | 'dismissed';
  alertType?: AlertType;
  page?: number;
  pageSize?: number;
}): Promise<{
  data: (TenderAlert & { tenderInfo?: typeof tenderInfos.$inferSelect })[];
  total: number;
}> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters.userId) {
    conditions.push(eq(tenderAlerts.userId, filters.userId));
  }
  if (filters.status) {
    conditions.push(eq(tenderAlerts.status, filters.status));
  }
  if (filters.alertType) {
    conditions.push(eq(tenderAlerts.alertType, filters.alertType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tenderAlerts)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select({
      alert: tenderAlerts,
      tenderInfo: tenderInfos,
    })
    .from(tenderAlerts)
    .leftJoin(tenderInfos, eq(tenderAlerts.tenderInfoId, tenderInfos.id))
    .where(whereClause)
    .orderBy(desc(tenderAlerts.scheduledTime))
    .limit(pageSize)
    .offset(offset);

  return {
    data: data.map(d => ({
      ...d.alert,
      tenderInfo: d.tenderInfo || undefined,
    })),
    total,
  };
}

/**
 * 获取预警详情
 */
export async function getAlertById(id: number): Promise<TenderAlert | null> {
  const [alert] = await db
    .select()
    .from(tenderAlerts)
    .where(eq(tenderAlerts.id, id))
    .limit(1);

  return alert || null;
}

/**
 * 标记预警为已读
 */
export async function markAlertAsRead(id: number): Promise<TenderAlert> {
  const [alert] = await db
    .update(tenderAlerts)
    .set({
      status: 'read',
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tenderAlerts.id, id))
    .returning();

  return alert;
}

/**
 * 批量标记预警为已读
 */
export async function markAlertsAsRead(userId: number, ids?: number[]): Promise<void> {
  const conditions = [eq(tenderAlerts.userId, userId)];
  if (ids && ids.length > 0) {
    conditions.push(inArray(tenderAlerts.id, ids));
  }

  await db
    .update(tenderAlerts)
    .set({
      status: 'read',
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(...conditions));
}

/**
 * 忽略预警
 */
export async function dismissAlert(id: number): Promise<TenderAlert> {
  const [alert] = await db
    .update(tenderAlerts)
    .set({
      status: 'dismissed',
      updatedAt: new Date(),
    })
    .where(eq(tenderAlerts.id, id))
    .returning();

  return alert;
}

/**
 * 获取未读预警数量
 */
export async function getUnreadAlertCount(userId: number): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tenderAlerts)
    .where(
      and(
        eq(tenderAlerts.userId, userId),
        eq(tenderAlerts.status, 'sent')
      )
    );

  return Number(count);
}

// ============================================
// 预警生成与触发
// ============================================

/**
 * 为招标信息生成预警
 */
export async function generateAlertsForTender(tenderInfoId: number): Promise<TenderAlert[]> {
  const tenderInfo = await db
    .select()
    .from(tenderInfos)
    .where(eq(tenderInfos.id, tenderInfoId))
    .limit(1);

  if (!tenderInfo[0]) {
    return [];
  }

  const tender = tenderInfo[0];

  // 匹配订阅规则
  const matchedSubscriptions = await matchTenderToSubscriptions(tender);

  const alerts: TenderAlert[] = [];

  for (const subscription of matchedSubscriptions) {
    // 获取用户预警设置
    const setting = await getAlertSetting(subscription.userId);
    const registerDays = setting?.registerDays ?? 1;
    const questionDays = setting?.questionDays ?? 1;
    const submissionDays = setting?.submissionDays ?? 3;
    const openBidDays = setting?.openBidDays ?? 1;

    // 生成报名截止预警
    if (tender.registerEndDate) {
      const scheduledTime = new Date(tender.registerEndDate);
      scheduledTime.setDate(scheduledTime.getDate() - registerDays);

      if (scheduledTime > new Date()) {
        const alert = await createAlert({
          tenderInfoId: tender.id,
          subscriptionId: subscription.id,
          userId: subscription.userId,
          alertType: 'register_deadline',
          alertTitle: `报名截止预警：${tender.title?.substring(0, 50) || '招标项目'}`,
          alertMessage: `项目「${tender.title}」将于 ${formatDate(tender.registerEndDate)} 截止报名，请及时处理。`,
          targetTime: tender.registerEndDate,
          scheduledTime,
        });
        alerts.push(alert);
      }
    }

    // 生成答疑截止预警
    if (tender.questionDeadline) {
      const scheduledTime = new Date(tender.questionDeadline);
      scheduledTime.setDate(scheduledTime.getDate() - questionDays);

      if (scheduledTime > new Date()) {
        const alert = await createAlert({
          tenderInfoId: tender.id,
          subscriptionId: subscription.id,
          userId: subscription.userId,
          alertType: 'question_deadline',
          alertTitle: `答疑截止预警：${tender.title?.substring(0, 50) || '招标项目'}`,
          alertMessage: `项目「${tender.title}」将于 ${formatDate(tender.questionDeadline)} 截止答疑，请及时处理。`,
          targetTime: tender.questionDeadline,
          scheduledTime,
        });
        alerts.push(alert);
      }
    }

    // 生成投标截止预警
    if (tender.submissionDeadline) {
      const scheduledTime = new Date(tender.submissionDeadline);
      scheduledTime.setDate(scheduledTime.getDate() - submissionDays);

      if (scheduledTime > new Date()) {
        const alert = await createAlert({
          tenderInfoId: tender.id,
          subscriptionId: subscription.id,
          userId: subscription.userId,
          alertType: 'submission_deadline',
          alertTitle: `投标截止预警：${tender.title?.substring(0, 50) || '招标项目'}`,
          alertMessage: `项目「${tender.title}」将于 ${formatDate(tender.submissionDeadline)} 截止投标，请及时提交投标文件。`,
          targetTime: tender.submissionDeadline,
          scheduledTime,
        });
        alerts.push(alert);
      }
    }

    // 生成开标预警
    if (tender.openBidDate) {
      const scheduledTime = new Date(tender.openBidDate);
      scheduledTime.setDate(scheduledTime.getDate() - openBidDays);

      if (scheduledTime > new Date()) {
        const alert = await createAlert({
          tenderInfoId: tender.id,
          subscriptionId: subscription.id,
          userId: subscription.userId,
          alertType: 'open_bid',
          alertTitle: `开标预警：${tender.title?.substring(0, 50) || '招标项目'}`,
          alertMessage: `项目「${tender.title}」将于 ${formatDate(tender.openBidDate)} 开标，地点：${tender.openBidLocation || '待定'}。`,
          targetTime: tender.openBidDate,
          scheduledTime,
        });
        alerts.push(alert);
      }
    }
  }

  return alerts;
}

/**
 * 发送待发送的预警
 */
export async function sendPendingAlerts(): Promise<{
  sent: number;
  failed: number;
}> {
  const now = new Date();

  const pendingAlerts = await db
    .select()
    .from(tenderAlerts)
    .where(
      and(
        eq(tenderAlerts.status, 'pending'),
        lte(tenderAlerts.scheduledTime, now)
      )
    )
    .limit(100);

  let sent = 0;
  let failed = 0;

  for (const alert of pendingAlerts) {
    try {
      // 根据渠道发送预警
      if (alert.channel === 'system') {
        // 系统内通知，直接标记为已发送
        await db
          .update(tenderAlerts)
          .set({
            status: 'sent',
            sentAt: now,
            updatedAt: now,
          })
          .where(eq(tenderAlerts.id, alert.id));

        // 同步到通知中心
        await syncAlertToNotificationCenter(alert);
        sent++;
      } else if (alert.channel === 'wechat_work') {
        // 企业微信推送
        const setting = await getAlertSetting(alert.userId);
        if (setting?.wechatWorkWebhook) {
          await sendToWechatWork(setting.wechatWorkWebhook, alert);
          await db
            .update(tenderAlerts)
            .set({
              status: 'sent',
              sentAt: now,
              updatedAt: now,
            })
            .where(eq(tenderAlerts.id, alert.id));
          sent++;
        } else {
          throw new Error('未配置企业微信Webhook');
        }
      } else if (alert.channel === 'dingtalk') {
        // 钉钉推送
        const setting = await getAlertSetting(alert.userId);
        if (setting?.dingtalkWebhook) {
          await sendToDingtalk(setting.dingtalkWebhook, alert);
          await db
            .update(tenderAlerts)
            .set({
              status: 'sent',
              sentAt: now,
              updatedAt: now,
            })
            .where(eq(tenderAlerts.id, alert.id));
          sent++;
        } else {
          throw new Error('未配置钉钉Webhook');
        }
      }
    } catch (error) {
      console.error(`发送预警失败 [${alert.id}]:`, error);
      await db
        .update(tenderAlerts)
        .set({
          errorMessage: error instanceof Error ? error.message : '发送失败',
          updatedAt: now,
        })
        .where(eq(tenderAlerts.id, alert.id));
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * 同步预警到通知中心
 */
async function syncAlertToNotificationCenter(alert: TenderAlert): Promise<void> {
  // 获取招标信息
  const tenderInfo = await db
    .select()
    .from(tenderInfos)
    .where(eq(tenderInfos.id, alert.tenderInfoId))
    .limit(1);

  if (!tenderInfo[0]) return;

  // TODO: 集成现有的通知服务
  // 可以调用notifications表或其他通知机制
  console.log(`[预警通知] 用户${alert.userId}: ${alert.alertTitle}`);
}

/**
 * 发送到企业微信
 */
async function sendToWechatWork(webhook: string, alert: TenderAlert): Promise<void> {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        content: `## ${alert.alertTitle}\n\n${alert.alertMessage}\n\n> 类型：${getAlertTypeLabel(alert.alertType)}\n> 时间：${formatDate(alert.targetTime)}`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`企业微信推送失败: ${response.statusText}`);
  }
}

/**
 * 发送到钉钉
 */
async function sendToDingtalk(webhook: string, alert: TenderAlert): Promise<void> {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: alert.alertTitle,
        text: `### ${alert.alertTitle}\n\n${alert.alertMessage}\n\n- 类型：${getAlertTypeLabel(alert.alertType)}\n- 时间：${formatDate(alert.targetTime)}`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`钉钉推送失败: ${response.statusText}`);
  }
}

// ============================================
// 辅助函数
// ============================================

function formatDate(date: Date | null): string {
  if (!date) return '待定';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAlertTypeLabel(type: AlertType): string {
  const labels: Record<AlertType, string> = {
    register_deadline: '报名截止',
    question_deadline: '答疑截止',
    submission_deadline: '投标截止',
    open_bid: '开标时间',
  };
  return labels[type] || type;
}

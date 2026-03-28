/**
 * 会话管理服务
 * 管理用户会话，支持会话查询、撤销等功能
 */

import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { eq, and, gt, lt, isNull, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

// 会话信息
export interface SessionInfo {
  id: number;
  userId: number;
  tokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  expiresAt: Date;
  lastAccessedAt: Date;
  createdAt: Date;
  // 关联的用户信息
  user?: {
    id: number;
    username: string;
    realName: string;
  };
}

// 设备信息解析结果
export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
}

/**
 * 创建会话
 */
export async function createSession(
  userId: number,
  tokenHash: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    expiresAt?: Date;
  }
): Promise<SessionInfo> {
  // 默认7天过期
  const expiresAt = options?.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      ipAddress: options?.ipAddress || null,
      userAgent: options?.userAgent || null,
      deviceInfo: options?.deviceInfo || null,
      expiresAt,
      lastAccessedAt: new Date(),
    })
    .returning();

  return session as SessionInfo;
}

/**
 * 通过令牌哈希获取会话
 */
export async function getSessionByTokenHash(tokenHash: string): Promise<SessionInfo | null> {
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, tokenHash),
      gt(sessions.expiresAt, new Date())
    ),
  });

  return session as SessionInfo | null;
}

/**
 * 获取用户的所有活跃会话
 */
export async function getUserSessions(userId: number): Promise<SessionInfo[]> {
  const sessionList = await db.query.sessions.findMany({
    where: and(
      eq(sessions.userId, userId),
      gt(sessions.expiresAt, new Date())
    ),
    orderBy: [desc(sessions.lastAccessedAt)],
  });

  return sessionList as SessionInfo[];
}

/**
 * 获取会话详情
 */
export async function getSessionById(sessionId: number): Promise<SessionInfo | null> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  return session as SessionInfo | null;
}

/**
 * 更新会话最后访问时间
 */
export async function updateSessionLastAccessed(sessionId: number): Promise<void> {
  await db
    .update(sessions)
    .set({ lastAccessedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * 撤销会话（删除）
 */
export async function revokeSession(sessionId: number, userId: number): Promise<boolean> {
  const result = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * 撤销用户所有其他会话
 */
export async function revokeOtherSessions(
  userId: number,
  currentSessionId: number
): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        lt(sessions.id, currentSessionId),
        gt(sessions.id, 0) // 确保不是当前会话
      )
    );

  // 使用 not equal 来排除当前会话
  const allSessions = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sql`${sessions.id} != ${currentSessionId}`
      )
    );

  return allSessions.rowCount || 0;
}

import { sql } from 'drizzle-orm';

/**
 * 撤销用户所有会话
 */
export async function revokeAllUserSessions(userId: number): Promise<number> {
  const result = await db.delete(sessions).where(eq(sessions.userId, userId));
  return result.rowCount || 0;
}

/**
 * 清理过期会话
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()));

  return result.rowCount || 0;
}

/**
 * 解析User-Agent获取设备信息
 */
export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return { browser: '未知', os: '未知', device: '未知' };
  }

  const ua = userAgent.toLowerCase();

  // 检测浏览器
  let browser = '未知';
  if (ua.includes('edg/')) {
    browser = 'Edge';
  } else if (ua.includes('chrome/')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('opera') || ua.includes('opr/')) {
    browser = 'Opera';
  }

  // 检测操作系统
  let os = '未知';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac os')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }

  // 检测设备类型
  let device = '桌面端';
  if (ua.includes('mobile') || ua.includes('android')) {
    device = '移动端';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    device = '平板';
  }

  return { browser, os, device };
}

/**
 * 生成设备信息字符串
 */
export function formatDeviceInfo(userAgent: string | null): string {
  const { browser, os, device } = parseUserAgent(userAgent);
  return `${browser} / ${os} / ${device}`;
}

/**
 * 获取当前会话ID（从Cookie）
 */
export async function getCurrentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('session_id')?.value || null;
}

/**
 * 生成会话ID
 */
export function generateSessionId(): string {
  return randomUUID();
}

/**
 * 计算会话统计
 */
export async function getSessionStats(): Promise<{
  total: number;
  active: number;
  expired: number;
  uniqueUsers: number;
}> {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions);

  const [activeResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(gt(sessions.expiresAt, new Date()));

  const [expiredResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(lt(sessions.expiresAt, new Date()));

  const [uniqueUsersResult] = await db
    .select({ count: sql<number>`count(distinct ${sessions.userId})` })
    .from(sessions);

  return {
    total: Number(totalResult?.count || 0),
    active: Number(activeResult?.count || 0),
    expired: Number(expiredResult?.count || 0),
    uniqueUsers: Number(uniqueUsersResult?.count || 0),
  };
}

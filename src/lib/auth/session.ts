/**
 * 会话管理工具
 */

import { cookies } from 'next/headers';
import { verifyAccessToken } from './jwt';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface SessionUser {
  id: number;
  orgId: number;
  username: string;
  email: string;
  role: string;
}

export interface Session {
  user: SessionUser;
  expiresAt: Date;
}

/**
 * 获取当前会话
 * 用于服务端组件和API路由
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return null;
    }
    
    const payload = await verifyAccessToken(accessToken);
    
    // 获取用户信息
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });
    
    if (!user) {
      return null;
    }
    
    return {
      user: {
        id: user.id,
        orgId: user.departmentId || 0,
        username: user.username,
        email: user.email || '',
        role: user.departmentId ? 'user' : 'guest', // 简化角色处理
      },
      expiresAt: new Date((payload.exp || 0) * 1000),
    };
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}

/**
 * 获取当前用户ID
 */
export async function getCurrentUserId(): Promise<number | null> {
  const session = await getSession();
  return session?.user.id || null;
}

/**
 * 检查用户是否已登录
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * 要求用户已登录（用于API路由）
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error('未授权访问');
  }
  return session.user;
}

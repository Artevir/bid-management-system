/**
 * 登出API
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import {
  getRefreshTokenFromCookie,
  revokeSession,
  clearTokenCookies,
  getCurrentUser,
} from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  try {
    // 获取当前用户
    const currentUser = await getCurrentUser();
    
    // 获取刷新令牌
    const refreshToken = await getRefreshTokenFromCookie();
    
    if (refreshToken) {
      // 撤销会话
      await revokeSession(refreshToken);
    }
    
    // 清除Cookie
    await clearTokenCookies();
    
    // 记录登出日志
    if (currentUser) {
      await db.insert(auditLogs).values({
        userId: currentUser.userId,
        username: currentUser.username,
        action: 'logout',
        resource: 'user',
        resourceId: currentUser.userId,
        description: '登出成功',
        ipAddress,
        userAgent,
        requestMethod: 'POST',
        requestPath: '/api/auth/logout',
        responseStatus: 200,
        duration: Date.now() - startTime,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: '登出成功',
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // 即使出错也清除Cookie
    await clearTokenCookies();
    
    return NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    );
  }
}

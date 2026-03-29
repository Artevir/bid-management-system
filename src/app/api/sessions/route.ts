/**
 * 会话管理API
 * GET: 获取当前用户的会话列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getUserSessions,
  revokeSession,
  revokeOtherSessions,
  getSessionStats as _getSessionStats,
} from '@/lib/session/service';

// 获取会话列表
async function getSessions(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const sessions = await getUserSessions(userId);

    // 格式化返回数据，隐藏敏感信息
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      deviceInfo: session.deviceInfo,
      lastAccessedAt: session.lastAccessedAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: false, // 前端可以根据当前会话ID判断
    }));

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 });
  }
}

// 撤销其他会话
async function revokeSessions(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { sessionId, revokeAll } = body;

    if (revokeAll) {
      // 撤销所有其他会话
      const count = await revokeOtherSessions(userId, 0);
      return NextResponse.json({
        success: true,
        message: `已撤销 ${count} 个其他会话`,
      });
    }

    if (sessionId) {
      // 撤销指定会话
      const success = await revokeSession(sessionId, userId);
      if (success) {
        return NextResponse.json({ success: true, message: '会话已撤销' });
      } else {
        return NextResponse.json({ error: '会话不存在或无权操作' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('Revoke session error:', error);
    return NextResponse.json({ error: '撤销会话失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getSessions);
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, revokeSessions);
}

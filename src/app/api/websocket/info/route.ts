/**
 * WebSocket API路由
 * 为前端提供WebSocket连接信息
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// GET - 获取WebSocket连接信息
// ============================================

export async function GET(_request: NextRequest) {
  const protocol = process.env.COZE_PROJECT_DOMAIN_DEFAULT?.startsWith('https') 
    ? 'wss' 
    : 'ws';
  
  const wsUrl = `${protocol}://${process.env.COZE_PROJECT_DOMAIN_DEFAULT}/socket.io`;

  return NextResponse.json({
    url: wsUrl,
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    options: {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    },
    events: {
      connect: '客户端连接成功',
      disconnect: '客户端断开连接',
      error: '连接错误',
      notification: '收到新通知',
      project_update: '项目更新',
      document_upload: '文档上传',
      auth_success: '认证成功',
    },
    documentation: `${process.env.COZE_PROJECT_DOMAIN_DEFAULT}/api-docs#websocket`,
  });
}

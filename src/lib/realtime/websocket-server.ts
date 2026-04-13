/**
 * WebSocket实时通知服务（简化实现）
 * 用于实时推送系统消息、项目更新等
 *
 * 注意：当前为简化实现，完整功能需要安装 socket.io
 * 安装命令：pnpm add socket.io
 */

import { Server as SocketIOServer } from 'socket.io';

// ============================================
// 通知类型
// ============================================

export enum NotificationType {
  PROJECT_UPDATE = 'project_update',
  DOCUMENT_UPLOAD = 'document_upload',
  REVIEW_COMPLETE = 'review_complete',
  APPROVAL_COMPLETE = 'approval_complete',
  BID_RESULT = 'bid_result',
  SYSTEM_MESSAGE = 'system_message',
  TASK_ASSIGNED = 'task_assigned',
  DEADLINE_REMINDER = 'deadline_reminder',
}

// ============================================
// 通知数据结构
// ============================================

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  userId?: string;
  projectId?: string;
  companyId?: string;
  createdAt: Date;
  read: boolean;
}

// ============================================
// WebSocket客户端信息
// ============================================

export interface SocketClient {
  id: string;
  userId?: string;
  companyId?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

// ============================================
// WebSocket 服务器初始化
// ============================================

let io: SocketIOServer | null = null;

export function initWebSocket(httpServer: any): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: process.env.COZE_PROJECT_DOMAIN_DEFAULT || '*',
      methods: ['GET', 'POST'],
    },
  });

  if (!io) {
    throw new Error('Failed to initialize WebSocket server');
  }

  io.on('connection', (socket: any) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // 用户认证
    socket.on('authenticate', (data: { userId: string; companyId?: string }) => {
      socket.data.userId = data.userId;
      socket.data.companyId = data.companyId;
      console.log(`[WebSocket] User authenticated: ${data.userId}`);
    });

    // 订阅项目更新
    socket.on('subscribe_project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      console.log(`[WebSocket] Socket ${socket.id} subscribed to project ${projectId}`);
    });

    // 取消订阅项目更新
    socket.on('unsubscribe_project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      console.log(`[WebSocket] Socket ${socket.id} unsubscribed from project ${projectId}`);
    });
  });

  return io;
}

// ============================================
// 简化实现的通知发送
// ============================================

export async function sendNotificationToUser(
  userId: string,
  notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<void> {
  const fullNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    read: false,
  };

  console.log('[Notification] User:', userId, fullNotification);
  // 实际实现需要 WebSocket 连接
}

export async function sendNotificationToCompany(
  companyId: string,
  notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<void> {
  const fullNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    read: false,
  };

  console.log('[Notification] Company:', companyId, fullNotification);
}

export async function sendNotificationToProject(
  projectId: string,
  notification: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<void> {
  const fullNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    read: false,
    projectId,
  };

  console.log('[Notification] Project:', projectId, fullNotification);
}

export async function broadcastNotification(
  notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'type'> & {
    type: NotificationType.SYSTEM_MESSAGE;
  }
): Promise<void> {
  const fullNotification: Notification = {
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    read: false,
  };

  console.log('[Notification] Broadcast:', fullNotification);
}

export async function pushProjectUpdate(
  projectId: string,
  update: {
    field: string;
    oldValue: any;
    newValue: any;
    updatedBy: string;
  }
): Promise<void> {
  console.log('[Project Update] Project:', projectId, update);
}

export async function pushDocumentUpload(
  projectId: string,
  document: {
    id: string;
    name: string;
    type: string;
    size: number;
    uploadedBy: string;
  }
): Promise<void> {
  console.log('[Document Upload] Project:', projectId, document);
}

export interface OnlineStats {
  totalClients: number;
  authenticatedClients: number;
  clientsByCompany: Map<string, number>;
}

export function getOnlineStats(): OnlineStats {
  return {
    totalClients: 0,
    authenticatedClients: 0,
    clientsByCompany: new Map(),
  };
}

export function getUserOnlineStatus(_userId: string): boolean {
  return false;
}

export function disconnectUser(userId: string): void {
  console.log('[Disconnect] User:', userId);
}

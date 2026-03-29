/**
 * 协同编辑WebSocket服务
 * 实现实时协同编辑、在线用户显示、编辑锁机制
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { verifyAccessToken } from '@/lib/auth/jwt';

// ============================================
// 类型定义
// ============================================

interface EditorUser {
  userId: number;
  username: string;
  color: string; // 用户标识颜色
  cursor?: { line: number; column: number };
  selection?: { start: number; end: number };
}

interface EditorRoom {
  documentId: string;
  users: Map<number, EditorUser>;
  locks: Map<string, { userId: number; lockedAt: Date }>; // 章节锁
  lastActivity: Date;
}

interface WebSocketMessage {
  type: 'join' | 'leave' | 'cursor' | 'selection' | 'edit' | 'lock' | 'unlock' | 'sync' | 'ping';
  payload: unknown;
}

interface WebSocketWithUser extends WebSocket {
  userId?: number;
  documentId?: string;
}

// ============================================
// 全局状态
// ============================================

// 文档房间映射
const rooms = new Map<string, EditorRoom>();

// 用户连接映射
const userConnections = new Map<number, Set<WebSocketWithUser>>();

// 用户颜色池
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
];

// ============================================
// WebSocket服务器
// ============================================

let wss: WebSocketServer | null = null;

/**
 * 初始化WebSocket服务器
 */
export function initWebSocketServer(server: unknown) {
  if (wss) return wss;

  // 类型断言处理
  wss = new WebSocketServer({ server: server as any, path: '/ws/collaboration' });

  wss.on('connection', async (ws: WebSocketWithUser, req: IncomingMessage) => {
    try {
      // 从URL参数获取token
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const documentId = url.searchParams.get('documentId');

      if (!token || !documentId) {
        ws.close(4001, '缺少认证信息或文档ID');
        return;
      }

      // 验证token
      const payload = await verifyAccessToken(token);
      if (!payload) {
        ws.close(4002, '认证失败');
        return;
      }

      // 设置用户信息
      ws.userId = payload.userId;
      ws.documentId = documentId;

      // 加入房间
      await joinRoom(ws, documentId, payload.userId, payload.username || 'User');

      // 处理消息
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          handleMessage(ws, message);
        } catch (error) {
          console.error('Parse message error:', error);
        }
      });

      // 处理断开连接
      ws.on('close', () => {
        if (ws.userId && ws.documentId) {
          leaveRoom(ws, ws.documentId, ws.userId);
        }
      });

      // 发送初始状态
      sendInitialSync(ws, documentId);

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(5000, '服务器错误');
    }
  });

  return wss;
}

/**
 * 加入房间
 */
async function joinRoom(
  ws: WebSocketWithUser,
  documentId: string,
  userId: number,
  username: string
) {
  if (!rooms.has(documentId)) {
    rooms.set(documentId, {
      documentId,
      users: new Map(),
      locks: new Map(),
      lastActivity: new Date(),
    });
  }

  const room = rooms.get(documentId)!;

  // 分配用户颜色
  const colorIndex = room.users.size % USER_COLORS.length;
  const userColor = USER_COLORS[colorIndex];

  // 添加用户
  const user: EditorUser = {
    userId,
    username,
    color: userColor,
  };
  room.users.set(userId, user);
  room.lastActivity = new Date();

  // 记录连接
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(ws);

  // 广播用户加入
  broadcastToRoom(documentId, {
    type: 'join',
    payload: { user, users: Array.from(room.users.values()) },
  }, ws.userId);
}

/**
 * 离开房间
 */
function leaveRoom(ws: WebSocketWithUser, documentId: string, userId: number) {
  const room = rooms.get(documentId);
  if (!room) return;

  // 移除用户
  room.users.delete(userId);

  // 释放所有锁
  for (const [sectionId, lock] of room.locks.entries()) {
    if (lock.userId === userId) {
      room.locks.delete(sectionId);
    }
  }

  // 移除连接
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }

  // 广播用户离开
  broadcastToRoom(documentId, {
    type: 'leave',
    payload: { userId, users: Array.from(room.users.values()) },
  });

  // 清理空房间
  if (room.users.size === 0) {
    rooms.delete(documentId);
  }
}

/**
 * 处理消息
 */
function handleMessage(ws: WebSocketWithUser, message: WebSocketMessage) {
  const { type, payload } = message;

  switch (type) {
    case 'cursor':
      handleCursorUpdate(ws, payload as { line: number; column: number });
      break;
    case 'selection':
      handleSelectionUpdate(ws, payload as { start: number; end: number });
      break;
    case 'edit':
      handleEditUpdate(ws, payload as { sectionId: string; content: string; version: number });
      break;
    case 'lock':
      handleLockRequest(ws, payload as { sectionId: string });
      break;
    case 'unlock':
      handleUnlockRequest(ws, payload as { sectionId: string });
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', payload: {} }));
      break;
  }
}

/**
 * 处理光标更新
 */
function handleCursorUpdate(ws: WebSocketWithUser, payload: { line: number; column: number }) {
  if (!ws.documentId || !ws.userId) return;

  const room = rooms.get(ws.documentId);
  if (!room) return;

  const user = room.users.get(ws.userId);
  if (user) {
    user.cursor = payload;
    room.lastActivity = new Date();

    broadcastToRoom(ws.documentId, {
      type: 'cursor',
      payload: { userId: ws.userId, cursor: payload },
    }, ws.userId);
  }
}

/**
 * 处理选区更新
 */
function handleSelectionUpdate(ws: WebSocketWithUser, payload: { start: number; end: number }) {
  if (!ws.documentId || !ws.userId) return;

  const room = rooms.get(ws.documentId);
  if (!room) return;

  const user = room.users.get(ws.userId);
  if (user) {
    user.selection = payload;
    room.lastActivity = new Date();

    broadcastToRoom(ws.documentId, {
      type: 'selection',
      payload: { userId: ws.userId, selection: payload },
    }, ws.userId);
  }
}

/**
 * 处理编辑更新
 */
function handleEditUpdate(
  ws: WebSocketWithUser,
  payload: { sectionId: string; content: string; version: number }
) {
  if (!ws.documentId || !ws.userId) return;

  const room = rooms.get(ws.documentId);
  if (!room) return;

  // 检查章节锁
  const lock = room.locks.get(payload.sectionId);
  if (lock && lock.userId !== ws.userId) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: '该章节已被其他用户锁定' },
    }));
    return;
  }

  room.lastActivity = new Date();

  // 广播编辑内容
  broadcastToRoom(ws.documentId, {
    type: 'edit',
    payload: {
      userId: ws.userId,
      sectionId: payload.sectionId,
      content: payload.content,
      version: payload.version,
    },
  }, ws.userId);
}

/**
 * 处理锁请求
 */
function handleLockRequest(ws: WebSocketWithUser, payload: { sectionId: string }) {
  if (!ws.documentId || !ws.userId) return;

  const room = rooms.get(ws.documentId);
  if (!room) return;

  const existingLock = room.locks.get(payload.sectionId);
  if (existingLock) {
    ws.send(JSON.stringify({
      type: 'lock_failed',
      payload: { sectionId: payload.sectionId, lockedBy: existingLock.userId },
    }));
    return;
  }

  // 获取锁
  room.locks.set(payload.sectionId, {
    userId: ws.userId!,
    lockedAt: new Date(),
  });

  // 广播锁定状态
  broadcastToRoom(ws.documentId, {
    type: 'lock',
    payload: { sectionId: payload.sectionId, userId: ws.userId },
  });
}

/**
 * 处理解锁请求
 */
function handleUnlockRequest(ws: WebSocketWithUser, payload: { sectionId: string }) {
  if (!ws.documentId || !ws.userId) return;

  const room = rooms.get(ws.documentId);
  if (!room) return;

  const lock = room.locks.get(payload.sectionId);
  if (lock && lock.userId === ws.userId) {
    room.locks.delete(payload.sectionId);

    broadcastToRoom(ws.documentId, {
      type: 'unlock',
      payload: { sectionId: payload.sectionId, userId: ws.userId },
    });
  }
}

/**
 * 发送初始同步数据
 */
function sendInitialSync(ws: WebSocketWithUser, documentId: string) {
  const room = rooms.get(documentId);
  if (!room) return;

  ws.send(JSON.stringify({
    type: 'sync',
    payload: {
      users: Array.from(room.users.values()),
      locks: Array.from(room.locks.entries()).map(([sectionId, lock]) => ({
        sectionId,
        userId: lock.userId,
        lockedAt: lock.lockedAt,
      })),
    },
  }));
}

/**
 * 广播消息到房间
 */
function broadcastToRoom(
  documentId: string,
  message: WebSocketMessage,
  excludeUserId?: number
) {
  const room = rooms.get(documentId);
  if (!room) return;

  const messageStr = JSON.stringify(message);

  for (const [userId, _user] of room.users) {
    if (excludeUserId && userId === excludeUserId) continue;

    const connections = userConnections.get(userId);
    if (connections) {
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      }
    }
  }
}

/**
 * 获取房间信息
 */
export function getRoomInfo(documentId: string) {
  const room = rooms.get(documentId);
  if (!room) return null;

  return {
    documentId: room.documentId,
    users: Array.from(room.users.values()),
    locks: Array.from(room.locks.entries()).map(([sectionId, lock]) => ({
      sectionId,
      userId: lock.userId,
      lockedAt: lock.lockedAt,
    })),
    lastActivity: room.lastActivity,
  };
}

/**
 * 获取所有房间列表
 */
export function getAllRooms() {
  return Array.from(rooms.entries()).map(([id, room]) => ({
    documentId: id,
    userCount: room.users.size,
    lastActivity: room.lastActivity,
  }));
}

/**
 * 清理不活跃的房间
 */
export function cleanupInactiveRooms(maxInactiveTime: number = 30 * 60 * 1000) {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastActivity.getTime() > maxInactiveTime && room.users.size === 0) {
      rooms.delete(id);
    }
  }
}

// 定期清理不活跃房间
setInterval(() => cleanupInactiveRooms(), 10 * 60 * 1000);

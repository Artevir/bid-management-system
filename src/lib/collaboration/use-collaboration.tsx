'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================
// 类型定义
// ============================================

interface EditorUser {
  userId: number;
  username: string;
  color: string;
  cursor?: { line: number; column: number };
  selection?: { start: number; end: number };
}

interface SectionLock {
  sectionId: string;
  userId: number;
  lockedAt: Date;
}

interface CollaborationState {
  connected: boolean;
  users: EditorUser[];
  locks: SectionLock[];
  myUserId: number | null;
}

interface WebSocketMessage {
  type: string;
  payload: unknown;
}

interface UseCollaborationOptions {
  documentId: string;
  userId: number;
  username: string;
  onEdit?: (sectionId: string, content: string, version: number, userId: number) => void;
  onLock?: (sectionId: string, userId: number) => void;
  onUnlock?: (sectionId: string, userId: number) => void;
  onUserJoin?: (user: EditorUser) => void;
  onUserLeave?: (userId: number) => void;
}

// ============================================
// Hook实现
// ============================================

export function useCollaboration({
  documentId,
  userId,
  username: _username,
  onEdit,
  onLock,
  onUnlock,
  onUserJoin,
  onUserLeave,
}: UseCollaborationOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<CollaborationState>({
    connected: false,
    users: [],
    locks: [],
    myUserId: userId,
  });

  // 连接WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // 获取认证token
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('accessToken='))
        ?.split('=')[1];

      if (!token) {
        console.error('No auth token found');
        return;
      }

      // 构建WebSocket URL
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/collaboration?documentId=${documentId}&token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, connected: true }));
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Parse message error:', error);
        }
      };

      ws.onclose = (event) => {
        setState((prev) => ({ ...prev, connected: false }));
        console.log('WebSocket closed:', event.code, event.reason);

        // 自动重连
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Connect error:', error);
    }
  }, [documentId]);

  // 处理消息
  const handleMessage = useCallback((message: WebSocketMessage) => {
    const { type, payload } = message;

    switch (type) {
      case 'sync':
        setState((prev) => ({
          ...prev,
          users: (payload as { users: EditorUser[] }).users,
          locks: (payload as { locks: SectionLock[] }).locks,
        }));
        break;

      case 'join':
        const joinPayload = payload as { user: EditorUser; users: EditorUser[] };
        setState((prev) => ({
          ...prev,
          users: joinPayload.users,
        }));
        if (joinPayload.user.userId !== userId) {
          onUserJoin?.(joinPayload.user);
        }
        break;

      case 'leave':
        const leavePayload = payload as { userId: number; users: EditorUser[] };
        setState((prev) => ({
          ...prev,
          users: leavePayload.users,
        }));
        onUserLeave?.(leavePayload.userId);
        break;

      case 'cursor':
        const cursorPayload = payload as { userId: number; cursor: { line: number; column: number } };
        setState((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.userId === cursorPayload.userId ? { ...u, cursor: cursorPayload.cursor } : u
          ),
        }));
        break;

      case 'selection':
        const selectionPayload = payload as { userId: number; selection: { start: number; end: number } };
        setState((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.userId === selectionPayload.userId ? { ...u, selection: selectionPayload.selection } : u
          ),
        }));
        break;

      case 'edit':
        const editPayload = payload as { userId: number; sectionId: string; content: string; version: number };
        onEdit?.(editPayload.sectionId, editPayload.content, editPayload.version, editPayload.userId);
        break;

      case 'lock':
        const lockPayload = payload as { sectionId: string; userId: number };
        setState((prev) => ({
          ...prev,
          locks: [
            ...prev.locks.filter((l) => l.sectionId !== lockPayload.sectionId),
            { sectionId: lockPayload.sectionId, userId: lockPayload.userId, lockedAt: new Date() },
          ],
        }));
        onLock?.(lockPayload.sectionId, lockPayload.userId);
        break;

      case 'unlock':
        const unlockPayload = payload as { sectionId: string; userId: number };
        setState((prev) => ({
          ...prev,
          locks: prev.locks.filter((l) => l.sectionId !== unlockPayload.sectionId),
        }));
        onUnlock?.(unlockPayload.sectionId, unlockPayload.userId);
        break;

      case 'lock_failed':
        const lockFailedPayload = payload as { sectionId: string; lockedBy: number };
        console.warn('Lock failed:', lockFailedPayload);
        break;

      case 'error':
        console.error('Server error:', payload);
        break;
    }
  }, [userId, onEdit, onLock, onUnlock, onUserJoin, onUserLeave]);

  // 发送消息
  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // 发送光标位置
  const sendCursor = useCallback((line: number, column: number) => {
    send('cursor', { line, column });
  }, [send]);

  // 发送选区
  const sendSelection = useCallback((start: number, end: number) => {
    send('selection', { start, end });
  }, [send]);

  // 发送编辑内容
  const sendEdit = useCallback((sectionId: string, content: string, version: number) => {
    send('edit', { sectionId, content, version });
  }, [send]);

  // 请求锁定章节
  const requestLock = useCallback((sectionId: string) => {
    send('lock', { sectionId });
  }, [send]);

  // 释放章节锁
  const releaseLock = useCallback((sectionId: string) => {
    send('unlock', { sectionId });
  }, [send]);

  // 检查章节是否被锁定
  const isSectionLocked = useCallback((sectionId: string): boolean => {
    return state.locks.some((lock) => lock.sectionId === sectionId);
  }, [state.locks]);

  // 检查章节是否被当前用户锁定
  const isSectionLockedByMe = useCallback((sectionId: string): boolean => {
    const lock = state.locks.find((l) => l.sectionId === sectionId);
    return lock?.userId === userId;
  }, [state.locks, userId]);

  // 获取章节锁定者
  const getSectionLocker = useCallback((sectionId: string): EditorUser | null => {
    const lock = state.locks.find((l) => l.sectionId === sectionId);
    if (!lock) return null;
    return state.users.find((u) => u.userId === lock.userId) || null;
  }, [state.locks, state.users]);

  // 初始化连接
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  // 心跳保活
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        send('ping', {});
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [send]);

  return {
    ...state,
    sendCursor,
    sendSelection,
    sendEdit,
    requestLock,
    releaseLock,
    isSectionLocked,
    isSectionLockedByMe,
    getSectionLocker,
    reconnect: connect,
  };
}

// ============================================
// 在线用户列表组件
// ============================================

interface OnlineUsersProps {
  users: EditorUser[];
  currentUserId: number;
}

export function OnlineUsers({ users, currentUserId }: OnlineUsersProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-white"
            style={{ backgroundColor: user.color }}
            title={user.userId === currentUserId ? `${user.username} (我)` : user.username}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      {users.length > 5 && (
        <span className="text-xs text-muted-foreground">
          +{users.length - 5}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        {users.length} 人在线
      </span>
    </div>
  );
}

// ============================================
// 用户光标指示器组件
// ============================================

interface UserCursorProps {
  user: EditorUser;
  lineHeight: number;
  charWidth: number;
}

export function UserCursor({ user, lineHeight, charWidth }: UserCursorProps) {
  if (!user.cursor) return null;

  const top = user.cursor.line * lineHeight;
  const left = user.cursor.column * charWidth;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top,
        left,
        borderLeft: `2px solid ${user.color}`,
        height: lineHeight,
      }}
    >
      <div
        className="absolute -top-5 left-0 px-1 text-xs text-white rounded whitespace-nowrap"
        style={{ backgroundColor: user.color }}
      >
        {user.username}
      </div>
    </div>
  );
}

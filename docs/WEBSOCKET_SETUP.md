# WebSocket 实时通知配置指南

本文档提供投标管理平台的 WebSocket 实时通知功能配置指南。

## 前置要求

1. 已安装项目依赖：`pnpm add socket.io socket.io-client`
2. Node.js 版本 18+

## 功能概述

WebSocket 实时通知功能支持：

- 项目更新实时推送
- 文档上传实时通知
- 审核完成通知
- 中标结果通知
- 任务分配通知
- 截止日期提醒

## 服务器端配置

### 1. 启动自定义服务器（支持 WebSocket）

```bash
# 开发环境
pnpm run dev:websocket

# 生产环境
pnpm run build
pnpm run build:server
pnpm run start:websocket
```

### 2. 验证 WebSocket 服务

访问 WebSocket 信息端点：

```bash
curl http://localhost:5000/api/websocket/info
```

预期响应：

```json
{
  "url": "ws://localhost:5000/socket.io",
  "path": "/socket.io",
  "transports": ["websocket", "polling"],
  "options": {
    "reconnection": true,
    "reconnectionAttempts": 5,
    "reconnectionDelay": 1000,
    "reconnectionDelayMax": 5000,
    "timeout": 20000
  }
}
```

## 客户端使用

### 1. 安装客户端依赖

```bash
pnpm add socket.io-client
```

### 2. 连接到 WebSocket 服务器

创建 `src/lib/websocket/client.ts`：

```typescript
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

class WebSocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(userId?: string, companyId?: string) {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    const url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';
    
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id);
      
      // 发送认证信息
      this.socket?.emit('auth', { userId, companyId });
    });

    this.socket.on('auth_success', (data) => {
      console.log('Authentication successful:', data);
    });

    this.socket.on('notification', (notification: Notification) => {
      console.log('Received notification:', notification);
      this.emit('notification', notification);
    });

    this.socket.on('project_update', (data) => {
      console.log('Project update:', data);
      this.emit('project_update', data);
    });

    this.socket.on('document_upload', (data) => {
      console.log('Document upload:', data);
      this.emit('document_upload', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback?: Function) {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }
    
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsClient = new WebSocketClient();
```

### 3. 在 React 组件中使用

创建 `src/hooks/useWebSocket.ts`：

```typescript
'use client';

import { useEffect, useState } from 'react';
import { wsClient, Notification } from '@/lib/websocket/client';

export function useWebSocket(userId?: string, companyId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // 连接 WebSocket
    wsClient.connect(userId, companyId);
    setIsConnected(wsClient.isConnected());

    // 监听通知
    const handleNotification = (notification: Notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50)); // 保留最近50条
      
      // 显示浏览器通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192x192.png',
        });
      }
    };

    wsClient.on('notification', handleNotification);

    // 清理
    return () => {
      wsClient.off('notification', handleNotification);
      wsClient.disconnect();
    };
  }, [userId, companyId]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    isConnected,
    notifications,
    clearNotifications,
  };
}
```

### 4. 使用 Hook

```typescript
'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { Bell, X } from 'lucide-react';

export default function NotificationPanel() {
  const { isConnected, notifications, clearNotifications } = useWebSocket('user-123');

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <div className="relative">
      <button className="p-2 rounded-lg hover:bg-gray-100">
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {notifications.length}
          </span>
        )}
      </button>

      {notifications.length > 0 && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border overflow-hidden">
          <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-semibold">通知</h3>
            <button onClick={clearNotifications} className="text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-3 border-b last:border-0">
                <div className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    notification.priority === 'urgent' ? 'bg-red-500' :
                    notification.priority === 'high' ? 'bg-orange-500' :
                    notification.priority === 'medium' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{notification.title}</p>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 服务器端发送通知

### 1. 在 API 路由中发送通知

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { pushProjectUpdate } from '@/lib/realtime/websocket-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;
  const body = await request.json();

  // 更新项目
  // ...

  // 推送实时通知
  await pushProjectUpdate(parseInt(projectId), {
    field: 'status',
    oldValue: 'draft',
    newValue: 'in_progress',
    updatedBy: 'user-123',
  });

  return NextResponse.json({ success: true });
}
```

### 2. 发送自定义通知

```typescript
import { sendNotificationToUser } from '@/lib/realtime/websocket-server';

await sendNotificationToUser('user-123', {
  type: 'TASK_ASSIGNED',
  title: '新任务分配',
  message: '您被分配了新的审核任务',
  priority: 'high',
});
```

## 环境变量配置

在 `.env.local` 文件中添加：

```env
NEXT_PUBLIC_WS_URL=ws://localhost:5000
```

生产环境：

```env
NEXT_PUBLIC_WS_URL=wss://your-domain.com
```

## 性能优化

### 1. 使用消息队列

对于大量通知，使用消息队列缓冲：

```typescript
import Queue from 'bull';

const notificationQueue = new Queue('notifications', process.env.REDIS_URL);

notificationQueue.process(async (job) => {
  const { type, userId, data } = job.data;
  await sendNotificationToUser(userId, { type, ...data });
});

// 批量添加到队列
await notificationQueue.addBulk(notifications.map(n => ({
  data: n,
  opts: { priority: n.priority === 'urgent' ? 1 : 10 }
})));
```

### 2. 心跳检测

客户端定期发送心跳：

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    if (wsClient.isConnected()) {
      wsClient.socket?.emit('ping');
    }
  }, 30000); // 每30秒

  return () => clearInterval(interval);
}, []);
```

### 3. 断线重连

自动重连已默认启用，配置参数：

```typescript
this.socket = io(url, {
  reconnection: true,
  reconnectionAttempts: 10,  // 增加重连尝试次数
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,  // 增加重连延迟
});
```

## 安全考虑

1. **认证**: 所有连接都需要通过 auth 事件认证
2. **授权**: 只向授权用户发送相关通知
3. **加密**: 生产环境使用 WSS (WebSocket Secure)
4. **速率限制**: 限制单个客户端的连接频率

## 监控和调试

### 1. 服务器端日志

```typescript
io.on('connection', (socket) => {
  console.log(`[WebSocket] Connected: ${socket.id}`);
  
  socket.on('error', (error) => {
    console.error(`[WebSocket] Error: ${socket.id}`, error);
  });
});
```

### 2. 客户端日志

```typescript
this.socket.on('connect', () => {
  console.log('[Client] Connected');
});

this.socket.on('disconnect', (reason) => {
  console.log('[Client] Disconnected:', reason);
});
```

### 3. 使用 WebSocket 调试工具

- [Socket.io Admin UI](https://socket.io/docs/v4/admin-ui/)
- [WebSocket King](https://chrome.google.com/webstore/detail/websocket-king)
- [Simple WebSocket Client](https://chrome.google.com/webstore/detail/simple-websocket-client)

## 故障排查

### 连接失败

```bash
# 检查服务器是否运行
curl http://localhost:5000/api/websocket/info

# 检查防火墙
sudo ufw allow 5000/tcp

# 检查 WebSocket 端点
wscat -c ws://localhost:5000/socket.io
```

### 通知未收到

1. 检查用户是否正确认证
2. 检查用户是否订阅了相关项目/公司
3. 检查浏览器控制台是否有错误
4. 检查服务器日志

### 性能问题

1. 监控连接数：`io.sockets.sockets.size`
2. 监控消息队列长度
3. 限制单次通知数量
4. 使用批量发送

## 参考资料

- [Socket.IO 文档](https://socket.io/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [实时通知最佳实践](https://socket.io/docs/v4/server-api/)

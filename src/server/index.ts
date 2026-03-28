/**
 * WebSocket 服务器初始化
 * 在 Next.js 自定义服务器中集成 Socket.IO
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initWebSocket, pushProjectUpdate, pushDocumentUpload } from '@/lib/realtime/websocket-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '5000', 10);

// 创建 Next.js 应用
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // 创建 HTTP 服务器
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 初始化 WebSocket 服务器
  const io = initWebSocket(httpServer);

  // WebSocket 事件监听
  io.on('connection', (socket: any) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // 心跳检测
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // 断开连接
    socket.on('disconnect', (reason: any) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  // 启动服务器
  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server running`);
    });
});

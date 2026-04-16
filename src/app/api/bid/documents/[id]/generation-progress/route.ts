/**
 * 文档生成进度SSE API
 * GET /api/bid/documents/[id]/generation-progress
 */

import { NextRequest } from 'next/server';
import { generationProgressService } from '@/lib/services/generation-progress-service';
import { withDocumentPermission } from '@/lib/auth/middleware';
import { parseIdFromParams } from '@/lib/api/validators';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const middleware = await withDocumentPermission('read', (_req, p) =>
    parseIdFromParams(p, 'id', '文档')
  );
  const p = await params;
  return middleware(request, async (req) => {
    const documentId = parseIdFromParams(p, 'id', '文档');

    // 创建SSE响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // 发送当前进度
        const currentProgress = generationProgressService.getProgress(documentId);
        if (currentProgress) {
          const data = JSON.stringify({ type: 'initial', data: currentProgress });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // 订阅进度更新
        const unsubscribe = generationProgressService.subscribe(documentId, (update) => {
          try {
            const data = JSON.stringify(update);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            // 如果完成或失败，关闭连接
            if (update.type === 'complete' || update.type === 'error') {
              if (update.data.status === 'completed' || update.data.status === 'failed') {
                unsubscribe();
                controller.close();
              }
            }
          } catch (error) {
            console.error('SSE send error:', error);
          }
        });

        // 保持连接活跃的心跳
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch (_error) {
            clearInterval(heartbeat);
            unsubscribe();
          }
        }, 30000);

        // 清理函数
        req.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch (_error) {
            // 忽略关闭错误
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用Nginx缓冲
      },
    });
  });
}

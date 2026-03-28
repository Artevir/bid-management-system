import { NextRequest, NextResponse } from 'next/server';
import { generationProgressServiceV2 } from '@/lib/services/generation-progress-service-v2';
import { generationNotificationService } from '@/lib/services/generation-notification-service';

/**
 * GET /api/bid/documents/[id]/progress-v2
 * 获取生成进度（支持SSE）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    // 检查是否请求SSE
    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('text/event-stream')) {
      // 返回SSE流
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // 发送当前进度
          const progress = await generationProgressServiceV2.getProgress(documentId);
          if (progress) {
            const event = `data: ${JSON.stringify({ type: 'initial', data: progress })}\n\n`;
            controller.enqueue(encoder.encode(event));
          }

          // 订阅进度更新
          const unsubscribe = await generationProgressServiceV2.subscribe(
            documentId,
            (update) => {
              try {
                const event = `data: ${JSON.stringify(update)}\n\n`;
                controller.enqueue(encoder.encode(event));

                // 完成或失败时关闭连接
                if (update.type === 'complete' || (update.type === 'error' && update.data.status === 'failed')) {
                  controller.close();
                }
              } catch (error) {
                console.error('SSE error:', error);
              }
            }
          );

          // 保持连接活跃
          const keepAlive = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'));
            } catch {
              clearInterval(keepAlive);
              unsubscribe();
            }
          }, 15000);

          // 清理
          request.signal.addEventListener('abort', () => {
            clearInterval(keepAlive);
            unsubscribe();
            controller.close();
          });
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 普通请求返回当前进度
    const progress = await generationProgressServiceV2.getProgress(documentId);

    if (!progress) {
      return NextResponse.json({ error: '进度数据不存在' }, { status: 404 });
    }

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error('Get progress error:', error);
    return NextResponse.json(
      { error: error.message || '获取进度失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bid/documents/[id]/progress-v2
 * 控制生成进度（暂停/恢复）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    let progress;

    switch (action) {
      case 'pause':
        progress = await generationProgressServiceV2.pauseGeneration(documentId);
        break;

      case 'resume':
        progress = await generationProgressServiceV2.resumeGeneration(documentId);
        break;

      case 'clear':
        await generationProgressServiceV2.clearProgress(documentId);
        return NextResponse.json({ success: true, message: '进度数据已清理' });

      default:
        return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }

    if (!progress) {
      return NextResponse.json({ error: '操作失败' }, { status: 400 });
    }

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error('Control progress error:', error);
    return NextResponse.json(
      { error: error.message || '控制进度失败' },
      { status: 500 }
    );
  }
}

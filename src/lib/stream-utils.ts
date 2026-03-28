/**
 * 流式输出工具函数
 * 用于处理SSE流式响应
 */

/**
 * 创建SSE编码器
 */
export function createSSEEncoder() {
  const encoder = new TextEncoder();
  
  return {
    /**
     * 编码SSE消息
     */
    encode(data: unknown): Uint8Array {
      const json = JSON.stringify(data);
      return encoder.encode(`data: ${json}\n\n`);
    },
    
    /**
     * 编码文本块
     */
    encodeText(text: string): Uint8Array {
      return encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
    },
    
    /**
     * 编码完成信号
     */
    encodeComplete(): Uint8Array {
      return encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
    },
    
    /**
     * 编码错误信号
     */
    encodeError(error: string): Uint8Array {
      return encoder.encode(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
    },
    
    /**
     * 编码进度信息
     */
    encodeProgress(step: string, progress: number): Uint8Array {
      return encoder.encode(`data: ${JSON.stringify({ type: 'progress', step, progress })}\n\n`);
    },
  };
}

/**
 * SSE响应头
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
} as const;

/**
 * 创建流式响应
 */
export function createStreamResponse(
  callback: (controller: ReadableStreamDefaultController, encoder: ReturnType<typeof createSSEEncoder>) => Promise<void>
): Response {
  const encoder = createSSEEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await callback(controller, encoder);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        controller.enqueue(encoder.encodeError(errorMessage));
      } finally {
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: SSE_HEADERS,
  });
}

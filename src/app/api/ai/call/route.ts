/**
 * AI调用统一API
 * POST: 执行AI调用（流式/非流式）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { callAI, streamAI } from '@/lib/ai/ai-service';

function extractForwardHeaders(headers: Headers): Record<string, string> {
  const customHeaders: Record<string, string> = {};
  const forwardHeaders = ['authorization', 'x-api-key', 'x-request-id', 'x-session-id', 'cookie'];

  for (const key of forwardHeaders) {
    const value = headers.get(key);
    if (value) {
      customHeaders[key] = value;
    }
  }

  return customHeaders;
}

// POST /api/ai/call
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const {
      mode,
      agentId,
      systemPrompt,
      userMessage,
      configId,
      conversationHistory,
      temperature,
      thinking,
      caching,
      stream = true,
      context,
    } = body;

    // 验证参数
    if (!mode || !['agent', 'direct'].includes(mode)) {
      return NextResponse.json({ error: '无效的调用模式' }, { status: 400 });
    }

    if (mode === 'agent' && !agentId) {
      return NextResponse.json({ error: 'AI角色ID不能为空' }, { status: 400 });
    }

    if (mode === 'direct' && !systemPrompt && !userMessage) {
      return NextResponse.json({ error: '提示词或用户消息不能为空' }, { status: 400 });
    }

    // 提取请求头
    const customHeaders = extractForwardHeaders(request.headers);

    // 流式模式
    if (stream) {
      const encoder = new TextEncoder();
      const streamGenerator = streamAI(
        {
          mode,
          agentId,
          systemPrompt,
          userMessage,
          configId,
          conversationHistory,
          temperature,
          thinking,
          caching,
          context,
          userId: user.userId,
        },
        customHeaders
      );

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamGenerator) {
              const data = JSON.stringify(chunk);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            controller.close();
          } catch (error: any) {
            const errorData = JSON.stringify({
              type: 'error',
              error: error.message,
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 非流式模式
    const result = await callAI({
      mode,
      agentId,
      systemPrompt,
      userMessage,
      configId,
      conversationHistory,
      temperature,
      thinking,
      caching,
      context,
      userId: user.userId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('AI调用失败:', error);
    return NextResponse.json({ error: error.message || 'AI调用失败' }, { status: 500 });
  }
}

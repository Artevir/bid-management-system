/**
 * LLM聊天 API
 * POST: 执行对话（流式/非流式）
 */

import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  streamChat,
  invokeChat,
  addMessage,
  logCall,
  updateConfig,
  getConfigById,
  getDefaultConfig,
} from '@/lib/llm/service';

// POST /api/llm/chat
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const {
      configId,
      conversationId,
      messages,
      model,
      temperature,
      thinking,
      caching,
      stream = true,
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    // 获取配置
    let config: any = null;
    if (configId) {
      config = await getConfigById(configId);
    } else {
      config = await getDefaultConfig();
    }

    // 准备聊天参数
    const chatModel = model || config?.modelId || 'doubao-seed-1-8-251228';
    const chatTemperature = temperature ?? parseFloat(config?.defaultTemperature || '0.7');
    const chatThinking = thinking || (config?.defaultThinking ? 'enabled' : 'disabled');
    const chatCaching = caching || (config?.defaultCaching ? 'enabled' : 'disabled');

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 获取模型提供商
    const provider = chatModel.includes('deepseek')
      ? 'deepseek'
      : chatModel.includes('kimi')
      ? 'kimi'
      : chatModel.includes('glm')
      ? 'glm'
      : 'doubao';

    const startTime = Date.now();

    // 非流式模式
    if (!stream) {
      try {
        const content = await invokeChat(
          {
            messages,
            model: chatModel,
            temperature: chatTemperature,
            thinking: chatThinking,
            caching: chatCaching,
          },
          customHeaders
        );

        const latency = Date.now() - startTime;

        // 记录日志
        await logCall({
          configId: config?.id,
          conversationId,
          modelId: chatModel,
          provider: provider as any,
          inputTokens: messages.reduce((sum, m) => sum + (m.content?.length || 0), 0),
          outputTokens: content.length,
          latency,
          status: 'success',
          createdBy: user.userId,
        });

        // 添加消息到对话
        if (conversationId) {
          await addMessage({
            conversationId,
            role: 'assistant',
            content,
          });
        }

        // 更新配置最后使用时间
        if (config) {
          await updateConfig(config.id, {});
        }

        return NextResponse.json({
          success: true,
          content,
          latency,
          model: chatModel,
        });
      } catch (error: any) {
        await logCall({
          configId: config?.id,
          conversationId,
          modelId: chatModel,
          provider: provider as any,
          status: 'failed',
          errorMessage: error.message,
          createdBy: user.userId,
        });

        return NextResponse.json(
          { error: error.message || '调用失败' },
          { status: 500 }
        );
      }
    }

    // 流式模式
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        let firstTokenTime = 0;

        try {
          const chatStream = streamChat(
            {
              messages,
              model: chatModel,
              temperature: chatTemperature,
              thinking: chatThinking,
              caching: chatCaching,
            },
            customHeaders
          );

          for await (const chunk of chatStream) {
            // P0 致命风险修复：检查客户端是否已断开，及时停止大模型请求
            if (request.signal.aborted) {
              console.log('Client aborted, stopping chat stream generation');
              break;
            }

            if (!firstTokenTime) {
              firstTokenTime = Date.now();
            }
            fullContent += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // 只有在未中断的情况下才进行后续处理
          if (!request.signal.aborted) {
            const latency = Date.now() - startTime;
            const firstTokenLatency = firstTokenTime ? firstTokenTime - startTime : 0;

            // 记录日志
            await logCall({
              configId: config?.id,
              conversationId,
              modelId: chatModel,
              provider: provider as any,
              inputTokens: messages.reduce((sum, m) => sum + (m.content?.length || 0), 0),
              outputTokens: fullContent.length,
              latency,
              firstTokenLatency,
              status: 'success',
              createdBy: user.userId,
            });

            // 添加消息到对话
            if (conversationId) {
              await addMessage({
                conversationId,
                role: 'assistant',
                content: fullContent,
              });
            }

            // 更新配置最后使用时间
            if (config) {
              await updateConfig(config.id, {});
            }
          }

          controller.close();
        } catch (error: any) {
          if (!request.signal.aborted) {
            await logCall({
              configId: config?.id,
            conversationId,
            modelId: chatModel,
            provider: provider as any,
            status: 'failed',
            errorMessage: error.message,
            createdBy: user.userId,
          });

          controller.enqueue(encoder.encode(`\n[错误] ${error.message}`));
          controller.close();
        }
      },
    });

    return new NextResponse(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('LLM聊天失败:', error);
    return NextResponse.json(
      { error: error.message || '调用失败' },
      { status: 500 }
    );
  }
}

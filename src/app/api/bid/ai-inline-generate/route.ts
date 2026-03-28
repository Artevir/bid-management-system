/**
 * AI即时内容生成API
 * 支持在文档编辑器中插入或替换AI生成的内容
 * 支持AI角色调用或直接调用大模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { promptTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      prompt,
      context,
      agentId,
      mode, // 'insert' | 'replace'
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: '请输入生成指令' }, { status: 400 });
    }

    // 构建完整的提示词
    let systemPrompt = '你是一个专业的标书文档撰写助手，擅长撰写投标文档、技术方案等内容。';
    let userPrompt = prompt;
    let modelName = 'doubao-pro-32k';

    // 如果选择了AI角色，加载角色配置
    if (agentId) {
      const [agent] = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.id, agentId));

      if (agent) {
        // 使用AI角色的系统提示词
        if (agent.systemPrompt) {
          systemPrompt = agent.systemPrompt;
        }
        
        // 如果有角色描述，添加到系统提示词
        if (agent.agentDescription) {
          systemPrompt += `\n\n你的角色：${agent.agentDescription}`;
        }

        // 使用AI角色的模型配置
        if (agent.modelName) {
          modelName = agent.modelName;
        }
      }
    }

    // 添加上下文信息
    const contextParts: string[] = [];
    
    if (context?.chapterTitle) {
      contextParts.push(`当前章节：${context.chapterTitle}`);
    }
    
    if (context?.selectedText) {
      if (mode === 'replace') {
        contextParts.push(`需要改写的原文：\n${context.selectedText}`);
      } else {
        contextParts.push(`参考内容：\n${context.selectedText}`);
      }
    }

    if (context?.surroundingContext) {
      const { before, after } = context.surroundingContext;
      if (before) {
        contextParts.push(`前文上下：\n${before}`);
      }
      if (after) {
        contextParts.push(`后文上下：\n${after}`);
      }
    }

    if (contextParts.length > 0) {
      userPrompt = `【上下文信息】\n${contextParts.join('\n\n')}\n\n【任务要求】\n${prompt}`;
    }

    // 提取请求头并创建LLM客户端
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 准备消息
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 调用LLM流式生成
          const llmStream = client.stream(messages, {
            model: modelName,
            temperature: 0.7,
          });

          for await (const chunk of llmStream) {
            if (chunk.content) {
              const content = chunk.content.toString();
              const message = `data: ${JSON.stringify({ type: 'text', content })}\n\n`;
              controller.enqueue(encoder.encode(message));
            }
          }

          // 发送完成信号
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorMessage = error instanceof Error ? error.message : '生成失败';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI inline generate error:', error);
    return NextResponse.json(
      { error: 'AI生成失败' },
      { status: 500 }
    );
  }
}

/**
 * AI 内容生成 API
 * POST: 根据提示生成方案内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { db } from '@/db';
import { schemeChapters, schemeGenerationLogs } from '@/db/scheme-schema';
import { eq } from 'drizzle-orm';

// POST /api/schemes/ai/generate
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { schemeId, chapterId, prompt, mode = 'default' } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: '生成提示不能为空' }, { status: 400 });
    }

    // 记录生成日志
    const [log] = await db
      .insert(schemeGenerationLogs)
      .values({
        schemeId: schemeId,
        chapterId: chapterId || null,
        generateType: chapterId ? 'segment' : 'full',
        generateMode: mode,
        inputPrompt: prompt,
        status: 'processing',
        createdBy: user.userId,
      })
      .returning();

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // TODO: 这里需要根据技能文档集成真实的 LLM 服务
          // 目前使用模拟生成内容
          const generatedContent = await generateContent(prompt, mode);

          // 模拟流式输出
          const chunks = generatedContent.split('\n\n');
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk + '\n\n'));
            await new Promise((r) => setTimeout(r, 100)); // 模拟延迟
          }

          // 更新章节内容
          if (chapterId) {
            await db
              .update(schemeChapters)
              .set({
                content: generatedContent,
                updatedAt: new Date(),
              })
              .where(eq(schemeChapters.id, chapterId));
          }

          // 更新生成日志
          await db
            .update(schemeGenerationLogs)
            .set({
              status: 'completed',
              outputContent: generatedContent,
              tokenUsed: generatedContent.length,
              completedAt: new Date(),
            })
            .where(eq(schemeGenerationLogs.id, log.id));

          controller.close();
        } catch (error) {
          // 更新错误状态
          await db
            .update(schemeGenerationLogs)
            .set({
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : '生成失败',
              completedAt: new Date(),
            })
            .where(eq(schemeGenerationLogs.id, log.id));

          controller.enqueue(encoder.encode('生成失败，请重试'));
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
    console.error('AI生成失败:', error);
    return NextResponse.json({ error: 'AI生成失败' }, { status: 500 });
  }
}

// 模拟内容生成（实际应调用 LLM 服务）
async function generateContent(_prompt: string, _mode: string): Promise<string> {
  // 这里应该集成真实的 LLM 服务
  // 参考 /skills/public/prod/llm 技能文档
  
  // 模拟生成的内容
  const sections = [
    `## 项目背景\n\n本项目旨在为客户提供一个完整的解决方案，满足其在业务发展中的各项需求。通过深入分析客户现状和未来规划，我们制定了详细的实施方案。`,
    
    `## 需求分析\n\n根据客户提供的需求文档，我们对项目进行了全面的需求分析。主要需求包括：\n\n1. 系统功能需求\n2. 性能指标要求\n3. 安全合规要求\n4. 可扩展性需求`,
    
    `## 技术方案\n\n我们采用先进的技术架构，确保系统的稳定性、安全性和可扩展性。核心技术栈包括：\n\n- 前端：React 19 + TypeScript\n- 后端：Node.js + Express\n- 数据库：PostgreSQL\n- 缓存：Redis`,
    
    `## 实施计划\n\n项目实施分为以下阶段：\n\n第一阶段：需求确认与系统设计（2周）\n第二阶段：核心功能开发（4周）\n第三阶段：测试与优化（2周）\n第四阶段：部署上线（1周）`,
    
    `## 团队配置\n\n我们将组建专业的项目团队，包括：\n\n- 项目经理 1名\n- 技术负责人 1名\n- 前端开发工程师 2名\n- 后端开发工程师 2名\n- 测试工程师 1名`,
  ];

  return sections.join('\n\n');
}

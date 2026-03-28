/**
 * AI编标API
 * POST: 生成章节内容（支持流式和非流式）
 * 
 * 已迁移至统一LLM适配层
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  generateChapterContent,
  optimizeChapterContent,
  retrieveRelevantKnowledge,
  saveGenerationLog,
} from '@/lib/bid/ai-generator';
import { getChapterDetail, updateChapter } from '@/lib/bid/service';
import { db } from '@/db';
import { bidDocuments, projects, responseItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createStreamResponse, createSSEEncoder } from '@/lib/stream-utils';
import {
  getLLM,
  createCozeAdapterWithHeaders,
  ChatMessage,
} from '@/lib/llm';
import { extractForwardHeaders } from '@/lib/llm/factory';

// ============================================
// 流式生成章节内容
// ============================================

async function generateContentStream(
  request: NextRequest,
  userId: number
): Promise<Response> {
  try {
    const body = await request.json();
    const { chapterId, style, useKnowledge } = body;

    if (!chapterId) {
      return NextResponse.json({ error: '缺少章节ID' }, { status: 400 });
    }

    // 获取章节信息
    const chapter = await getChapterDetail(chapterId);
    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 });
    }

    // 获取文档和项目信息
    const doc = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.id, chapter.documentId))
      .limit(1);

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, doc[0]?.projectId || 0))
      .limit(1);

    // 获取关联的要求
    let requirements: string[] = [];
    if (chapter.responseItemId) {
      const responseItem = await db
        .select()
        .from(responseItems)
        .where(eq(responseItems.id, chapter.responseItemId))
        .limit(1);
      
      if (responseItem.length > 0 && responseItem[0].requirement) {
        requirements = [responseItem[0].requirement];
      }
    }

    const customHeaders = extractForwardHeaders(request.headers);

    // 获取参考知识
    let referenceContent: string[] = [];
    if (useKnowledge) {
      const knowledge = await retrieveRelevantKnowledge(
        chapter.title,
        3,
        customHeaders
      );
      referenceContent = knowledge.map((k) => k.content);
    }

    // 构建prompt
    const styleGuide = {
      formal: '使用正式、专业的商务文书风格，语言严谨、规范',
      technical: '使用技术文档风格，注重技术细节和参数说明',
      concise: '使用简洁明了的风格，突出重点，避免冗余',
    };

    const systemPrompt = `你是一个专业的标书编写专家。请根据给定的要求生成标书章节内容。

写作要求：
${styleGuide[style as keyof typeof styleGuide] || styleGuide.formal}

注意事项：
1. 内容要具体、可操作，避免空泛表述
2. 使用专业术语，但不要过于晦涩
3. 适当使用列表、表格等格式增强可读性
4. 确保内容与招标要求对应
5. 突出企业优势和解决方案亮点`;

    let userPrompt = `请为以下标书章节生成内容：

项目名称：${project[0]?.name || ''}
文档名称：${doc[0]?.name || ''}
章节标题：${chapter.title}
${chapter.type ? `章节类型：${chapter.type}` : ''}`;

    if (requirements.length > 0) {
      userPrompt += `\n\n招标要求：\n${requirements.map((r) => `- ${r}`).join('\n')}`;
    }

    if (referenceContent.length > 0) {
      userPrompt += `\n\n参考内容：\n${referenceContent.join('\n\n')}`;
    }

    userPrompt += '\n\n请生成完整的章节内容：';

    // 创建流式响应
    return createStreamResponse(async (controller, encoder) => {
      // 使用统一适配层
      const llm = customHeaders 
        ? createCozeAdapterWithHeaders(customHeaders) 
        : getLLM();
      
      let fullContent = '';

      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        const stream = llm.generateStream(messages, {
          temperature: 0.7,
        });

        for await (const chunk of stream) {
          if (!chunk.done && chunk.content) {
            fullContent += chunk.content;
            controller.enqueue(encoder.encodeText(chunk.content));
          }
        }

        // 保存生成记录
        await saveGenerationLog({
          chapterId,
          prompt: `生成章节: ${chapter.title}`,
          model: 'llm-adapter',
          generatedContent: fullContent,
          isAccepted: false,
          userId,
        });

        // 发送完成信号，包含字数统计
        controller.enqueue(encoder.encode({
          type: 'complete',
          wordCount: fullContent.length,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '生成失败';
        controller.enqueue(encoder.encodeError(errorMessage));
      }
    });
  } catch (error) {
    console.error('Generate content stream error:', error);
    return NextResponse.json({ error: '生成内容失败' }, { status: 500 });
  }
}

// ============================================
// 非流式生成章节内容（保留向后兼容）
// ============================================

async function generateContent(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { chapterId, style, useKnowledge } = body;

    if (!chapterId) {
      return NextResponse.json({ error: '缺少章节ID' }, { status: 400 });
    }

    // 获取章节信息
    const chapter = await getChapterDetail(chapterId);
    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 });
    }

    // 获取文档和项目信息
    const doc = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.id, chapter.documentId))
      .limit(1);

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, doc[0]?.projectId || 0))
      .limit(1);

    // 获取关联的要求（如果有响应矩阵项）
    let requirements: string[] = [];
    if (chapter.responseItemId) {
      const responseItem = await db
        .select()
        .from(responseItems)
        .where(eq(responseItems.id, chapter.responseItemId))
        .limit(1);
      
      if (responseItem.length > 0 && responseItem[0].requirement) {
        requirements = [responseItem[0].requirement];
      }
    }

    const customHeaders = extractForwardHeaders(request.headers);

    // 检索相关知识（如果启用）
    let referenceContent: string[] = [];
    if (useKnowledge) {
      const knowledge = await retrieveRelevantKnowledge(
        chapter.title,
        3,
        customHeaders
      );
      referenceContent = knowledge.map((k) => k.content);
    }

    // 生成内容
    const result = await generateChapterContent(
      {
        chapterTitle: chapter.title,
        chapterType: chapter.type || undefined,
        documentName: doc[0]?.name || '',
        projectName: project[0]?.name || '',
        requirements,
        referenceContent,
      },
      { style },
      customHeaders
    );

    // 保存生成记录
    await saveGenerationLog({
      chapterId,
      prompt: `生成章节: ${chapter.title}`,
      model: 'llm-adapter',
      generatedContent: result.content,
      isAccepted: false,
      userId,
    });

    return NextResponse.json({
      success: true,
      content: result.content,
      wordCount: result.wordCount,
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error('Generate content error:', error);
    return NextResponse.json({ error: '生成内容失败' }, { status: 500 });
  }
}

// ============================================
// 优化内容
// ============================================

async function optimizeContent(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { chapterId, optimizationType } = body;

    if (!chapterId || !optimizationType) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 获取章节内容
    const chapter = await getChapterDetail(chapterId);
    if (!chapter || !chapter.content) {
      return NextResponse.json({ error: '章节内容为空' }, { status: 400 });
    }

    const customHeaders = extractForwardHeaders(request.headers);

    // 优化内容
    const result = await optimizeChapterContent(
      chapter.content,
      optimizationType,
      customHeaders
    );

    // 保存生成记录
    await saveGenerationLog({
      chapterId,
      prompt: `优化内容: ${optimizationType}`,
      model: 'llm-adapter',
      generatedContent: result.content,
      isAccepted: false,
      userId,
    });

    return NextResponse.json({
      success: true,
      content: result.content,
      wordCount: result.wordCount,
    });
  } catch (error) {
    console.error('Optimize content error:', error);
    return NextResponse.json({ error: '优化内容失败' }, { status: 500 });
  }
}

// ============================================
// 流式优化内容
// ============================================

async function optimizeContentStream(
  request: NextRequest,
  userId: number
): Promise<Response> {
  try {
    const body = await request.json();
    const { chapterId, optimizationType } = body;

    if (!chapterId || !optimizationType) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const chapter = await getChapterDetail(chapterId);
    if (!chapter || !chapter.content) {
      return NextResponse.json({ error: '章节内容为空' }, { status: 400 });
    }

    const customHeaders = extractForwardHeaders(request.headers);

    const optimizationPrompts = {
      expand: '请对以下内容进行扩充，增加更多细节和说明，但保持原有结构和核心观点不变：',
      simplify: '请对以下内容进行精简，保留核心要点，删除冗余表述：',
      polish: '请对以下内容进行润色，改善语言表达，使其更加专业流畅：',
      format: '请对以下内容进行格式优化，使用合适的标题、列表、表格等格式增强可读性：',
    };

    const systemPrompt = `你是一个专业的文档编辑专家。请根据要求优化给定的内容。

要求：
1. 保持内容的准确性和完整性
2. 优化后要保留原文的核心意思
3. 语言要专业、规范`;

    return createStreamResponse(async (controller, encoder) => {
      const llm = customHeaders 
        ? createCozeAdapterWithHeaders(customHeaders) 
        : getLLM();
      
      let fullContent = '';

      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `${optimizationPrompts[optimizationType as keyof typeof optimizationPrompts]}\n\n${chapter.content}`,
          },
        ];

        const stream = llm.generateStream(messages, {
          temperature: 0.5,
        });

        for await (const chunk of stream) {
          if (!chunk.done && chunk.content) {
            fullContent += chunk.content;
            controller.enqueue(encoder.encodeText(chunk.content));
          }
        }

        await saveGenerationLog({
          chapterId,
          prompt: `优化内容: ${optimizationType}`,
          model: 'llm-adapter',
          generatedContent: fullContent,
          isAccepted: false,
          userId,
        });

        controller.enqueue(encoder.encode({
          type: 'complete',
          wordCount: fullContent.length,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '优化失败';
        controller.enqueue(encoder.encodeError(errorMessage));
      }
    });
  } catch (error) {
    console.error('Optimize content stream error:', error);
    return NextResponse.json({ error: '优化内容失败' }, { status: 500 });
  }
}

// ============================================
// 接受生成内容
// ============================================

async function acceptContent(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { chapterId, content } = body;

    if (!chapterId || !content) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 更新章节内容
    await updateChapter(chapterId, { content });

    return NextResponse.json({
      success: true,
      message: '内容已保存',
    });
  } catch (error) {
    console.error('Accept content error:', error);
    return NextResponse.json({ error: '保存内容失败' }, { status: 500 });
  }
}

// ============================================
// 路由分发
// ============================================

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const stream = searchParams.get('stream') === 'true';

  switch (action) {
    case 'optimize':
      if (stream) {
        // 流式优化需要绕过withAuth中间件
        try {
          const userId = 1; // TODO: 从session获取
          return await optimizeContentStream(request, userId);
        } catch (error) {
          return NextResponse.json({ error: '优化内容失败' }, { status: 500 });
        }
      }
      return withAuth(request, (req, userId) => optimizeContent(req, userId));
    case 'accept':
      return withAuth(request, (req, userId) => acceptContent(req, userId));
    default:
      if (stream) {
        // 流式生成需要绕过withAuth中间件
        try {
          const userId = 1; // TODO: 从session获取
          return await generateContentStream(request, userId);
        } catch (error) {
          return NextResponse.json({ error: '生成内容失败' }, { status: 500 });
        }
      }
      return withAuth(request, (req, userId) => generateContent(req, userId));
  }
}

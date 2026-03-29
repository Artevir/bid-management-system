/**
 * 章节模板生成API
 * POST: 使用提示词模板生成章节内容（流式）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  bidChapters,
  bidDocuments,
  projects,
  companies,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withChapterPermission } from '@/lib/auth/middleware';
import { getLLM, createCozeAdapterWithHeaders, ChatMessage, LLMFactory, extractForwardHeaders } from '@/lib/llm';
import { createStreamResponse } from '@/lib/stream-utils';
import { retrieveRelevantKnowledge } from '@/lib/bid/ai-generator';
import { AppError } from '@/lib/api/error-handler';
import { parseIdFromParams } from '@/lib/api/validators';

async function generateChapterContent(
  request: NextRequest,
  userId: number,
  params: any
): Promise<Response> {
  const chapterId = parseIdFromParams(params, 'id', '章节');
  const body = await request.json();
  const {
    templateId,
    parameters: inputParams = {},
    companyId,
    tags = [],
    useKnowledge = true,
    stream = true,
  } = body;

  // 获取章节信息
  const [chapter] = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.id, chapterId))
    .limit(1);

  if (!chapter) {
    throw AppError.notFound('章节');
  }

  // 获取文档和项目信息
  const [doc] = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, chapter.documentId))
    .limit(1);

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, doc?.projectId || 0))
    .limit(1);

  // 获取公司信息（如果指定）
  let company: any = null;
  if (companyId) {
    const [companyData] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, parseInt(companyId.toString())))
      .limit(1);
    company = companyData;
  }

  // 构建 LLM 消息
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个专业的投标文书专家。请根据提供的章节标题、文档背景和参考资料，生成高质量的章节内容。
要求：
1. 语言严谨、专业，符合投标文书规范。
2. 逻辑清晰，结构完整。
3. 充分结合提供的公司背景和知识库内容（如果有）。`,
    },
    {
      role: 'user',
      content: `项目名称：${project?.name || '未知'}
章节标题：${chapter.title}
文档背景：${doc?.name || '无'}
参考资料：${useKnowledge ? await retrieveRelevantKnowledge(chapter.title, project?.id) : '无'}
公司背景：${company ? `${company.name} (${company.shortName || ''}) - ${company.description || ''}` : '无'}
附加要求：${JSON.stringify(inputParams)}`,
    },
  ];

  // 调用 LLM (流式)
  const forwardHeaders = extractForwardHeaders(request.headers);
  const config = LLMFactory.getInstance().getConfig();
  const llm =
    config.defaultProvider === 'coze' && Object.keys(forwardHeaders).length > 0
      ? createCozeAdapterWithHeaders(forwardHeaders)
      : getLLM();
  
  if (stream) {
    return createStreamResponse(async (controller, encoder) => {
      try {
        const stream = await llm.chatStream({ messages });
        for await (const chunk of stream) {
          // P0 致命风险修复：检查客户端是否已断开，及时释放资源
          if (request.signal.aborted) {
            console.log('Client aborted, stopping chapter generation stream');
            break;
          }
          controller.enqueue(encoder.encodeText(chunk));
        }
        
        if (!request.signal.aborted) {
          controller.enqueue(encoder.encodeComplete());
        }
      } catch (error) {
        if (!request.signal.aborted) {
          const errorMessage = error instanceof Error ? error.message : '生成失败';
          controller.enqueue(encoder.encodeError(errorMessage));
        }
      }
    }, request.signal);
  } else {
    const response = await llm.chat({ messages });
    return NextResponse.json({ content: response.content });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const middleware = await withChapterPermission('edit', (req, p) => parseIdFromParams(p, 'id', '章节'));
  const p = await params;
  return middleware(request, generateChapterContent, p);
}

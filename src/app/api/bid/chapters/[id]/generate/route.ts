/**
 * 章节模板生成API
 * POST: 使用提示词模板生成章节内容（流式）
 * 
 * 支持功能：
 * - 选择提示词模板
 * - 输入参数
 * - 关联公司
 * - 关联标签
 * - 流式输出
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  bidChapters,
  bidDocuments,
  projects,
  promptTemplates,
  promptParameters,
  schemeGenerations,
  companies,
  responseItems,
} from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';
import { checkChapterPermission } from '@/lib/auth/resource-permission';
import { getLLM, createCozeAdapterWithHeaders, ChatMessage } from '@/lib/llm';
import { extractForwardHeaders } from '@/lib/llm/factory';
import { createStreamResponse } from '@/lib/stream-utils';
import { retrieveRelevantKnowledge } from '@/lib/bid/ai-generator';

// ============================================
// POST: 使用模板生成章节内容
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const {
      chapterId,
      templateId,
      parameters: inputParams = {},
      companyId,
      tags = [],
      useKnowledge = true,
      stream = true,
    } = body;

    if (!chapterId) {
      return NextResponse.json({ error: '缺少章节ID' }, { status: 400 });
    }

    // 权限检查：编辑章节（生成内容需要编辑权限）
    const permissionResult = await checkChapterPermission(user.userId, chapterId, 'edit');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权编辑此章节' },
        { status: 403 }
      );
    }

    // 获取章节信息
    const [chapter] = await db
      .select()
      .from(bidChapters)
      .where(eq(bidChapters.id, chapterId))
      .limit(1);

    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 });
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
    let company: { id: number; name: string; shortName?: string | null } | null = null;
    if (companyId) {
      const [companyData] = await db
        .select({
          id: companies.id,
          name: companies.name,
          shortName: companies.shortName,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      company = companyData || null;
    }

    // 获取关联的要求
    let requirements: string[] = [];
    if (chapter.responseItemId) {
      const [responseItem] = await db
        .select()
        .from(responseItems)
        .where(eq(responseItems.id, chapter.responseItemId))
        .limit(1);
      
      if (responseItem?.requirement) {
        requirements = [responseItem.requirement];
      }
    }

    const customHeaders = extractForwardHeaders(request.headers);
    const llm = customHeaders 
      ? createCozeAdapterWithHeaders(customHeaders) 
      : getLLM();

    // 如果指定了模板，使用模板生成
    if (templateId) {
      return await generateWithTemplate({
        chapterId,
        chapter,
        templateId,
        inputParams,
        companyId,
        tags,
        project,
        doc,
        company,
        requirements,
        useKnowledge,
        customHeaders,
        llm,
        userId: user.userId,
        stream,
      });
    }

    // 否则使用默认生成方式
    return await generateWithDefault({
      chapterId,
      chapter,
      companyId,
      tags,
      project,
      doc,
      company,
      requirements,
      useKnowledge,
      customHeaders,
      llm,
      userId: user.userId,
      stream,
    });
  } catch (error) {
    console.error('章节生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 使用模板生成
// ============================================

async function generateWithTemplate(params: {
  chapterId: number;
  chapter: typeof bidChapters.$inferSelect;
  templateId: number;
  inputParams: Record<string, string>;
  companyId?: number;
  tags: string[];
  project: typeof projects.$inferSelect | undefined;
  doc: typeof bidDocuments.$inferSelect | undefined;
  company: { id: number; name: string; shortName?: string | null } | null;
  requirements: string[];
  useKnowledge: boolean;
  customHeaders: Record<string, string>;
  llm: ReturnType<typeof getLLM>;
  userId: number;
  stream: boolean;
}): Promise<Response> {
  const {
    chapterId,
    chapter,
    templateId,
    inputParams,
    companyId,
    tags,
    project,
    doc,
    company,
    requirements,
    useKnowledge,
    customHeaders,
    llm,
    userId,
    stream,
  } = params;

  // 获取模板
  const [template] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, templateId))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 });
  }

  // 获取模板参数定义
  const paramDefs = await db
    .select()
    .from(promptParameters)
    .where(eq(promptParameters.templateId, templateId))
    .orderBy(asc(promptParameters.sortOrder));

  // 构建参数值（合并默认值和输入值）
  const paramValues: Record<string, string> = {};
  
  // 先填充默认值和自动绑定
  for (const param of paramDefs) {
    // 自动绑定项目字段
    if (param.bindingType === 'project_field' && project && param.bindingField) {
      const value = getNestedValue(project, param.bindingField);
      if (value !== undefined) {
        paramValues[param.name] = String(value);
        continue;
      }
    }
    if (param.defaultValue) {
      paramValues[param.name] = param.defaultValue;
    }
  }
  
  // 覆盖输入值
  Object.assign(paramValues, inputParams);

  // 添加章节相关的默认参数
  if (!paramValues.chapterTitle) paramValues.chapterTitle = chapter.title;
  if (!paramValues.projectName && project) paramValues.projectName = project.name;
  if (!paramValues.documentName && doc) paramValues.documentName = doc.name;
  if (!paramValues.companyName && company) paramValues.companyName = company.name;
  if (!paramValues.companyShortName && company?.shortName) paramValues.companyShortName = company.shortName;

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

  // 渲染提示词
  let renderedPrompt = template.content;
  let renderedSystemPrompt = template.systemPrompt || '';

  // 替换参数占位符 {{param}}
  for (const [key, value] of Object.entries(paramValues)) {
    const placeholder = `{{${key}}}`;
    renderedPrompt = renderedPrompt.replace(new RegExp(placeholder, 'g'), value);
    renderedSystemPrompt = renderedSystemPrompt.replace(new RegExp(placeholder, 'g'), value);
  }

  // 添加招标要求
  if (requirements.length > 0) {
    renderedPrompt += `\n\n招标要求：\n${requirements.map((r) => `- ${r}`).join('\n')}`;
  }

  // 添加参考内容
  if (referenceContent.length > 0) {
    renderedPrompt += `\n\n参考内容：\n${referenceContent.join('\n\n')}`;
  }

  // 创建生成记录
  const [generation] = await db
    .insert(schemeGenerations)
    .values({
      chapterId,
      templateId,
      templateVersion: template.currentVersion,
      parameters: JSON.stringify(paramValues),
      companyId: companyId || null,
      status: 'generating',
      modelProvider: template.modelProvider,
      modelName: template.modelName,
      createdBy: userId,
    })
    .returning();

  // 更新章节的模板关联
  await db
    .update(bidChapters)
    .set({
      promptTemplateId: templateId,
      promptParameters: JSON.stringify(paramValues),
      companyId: companyId || null,
      tags: JSON.stringify(tags),
      updatedAt: new Date(),
    })
    .where(eq(bidChapters.id, chapterId));

  const messages: ChatMessage[] = [];
  
  if (renderedSystemPrompt) {
    messages.push({ role: 'system', content: renderedSystemPrompt });
  }
  
  messages.push({ role: 'user', content: renderedPrompt });

  // 生成配置
  const options: Record<string, unknown> = {};
  if (template.modelName) options.model = template.modelName;
  if (template.temperature) options.temperature = parseFloat(template.temperature);
  if (template.maxTokens) options.maxTokens = template.maxTokens;

  if (stream) {
    return createStreamResponse(async (controller, encoder) => {
      let fullContent = '';
      let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null = null;
      const startTime = Date.now();

      try {
        for await (const chunk of llm.generateStream(messages, options)) {
          if (chunk.content) {
            fullContent += chunk.content;
            controller.enqueue(encoder.encodeText(chunk.content));
          }
          if (chunk.usage) {
            usage = chunk.usage;
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode({
              type: 'complete',
              wordCount: fullContent.length,
              usage,
            }));
          }
        }

        // 更新生成记录
        await db
          .update(schemeGenerations)
          .set({
            title: chapter.title,
            content: fullContent,
            status: 'completed',
            promptTokens: usage?.promptTokens,
            completionTokens: usage?.completionTokens,
            totalTokens: usage?.totalTokens,
            duration: Date.now() - startTime,
            updatedAt: new Date(),
          })
          .where(eq(schemeGenerations.id, generation.id));

        // 更新模板使用次数
        await db
          .update(promptTemplates)
          .set({ 
            useCount: template.useCount + 1,
            updatedAt: new Date() 
          })
          .where(eq(promptTemplates.id, templateId));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '生成失败';
        
        await db
          .update(schemeGenerations)
          .set({
            status: 'failed',
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(schemeGenerations.id, generation.id));

        controller.enqueue(encoder.encodeError(errorMessage));
      }
    });
  } else {
    // 非流式响应
    const startTime = Date.now();
    
    try {
      const result = await llm.generate(messages, options);

      // 更新生成记录
      await db
        .update(schemeGenerations)
        .set({
          title: chapter.title,
          content: result.content,
          status: 'completed',
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens,
          duration: Date.now() - startTime,
          updatedAt: new Date(),
        })
        .where(eq(schemeGenerations.id, generation.id));

      // 更新模板使用次数
      await db
        .update(promptTemplates)
        .set({ 
          useCount: template.useCount + 1,
          updatedAt: new Date() 
        })
        .where(eq(promptTemplates.id, templateId));

      return NextResponse.json({
        success: true,
        generationId: generation.id,
        content: result.content,
        finishReason: result.finishReason,
        usage: result.usage,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      
      await db
        .update(schemeGenerations)
        .set({
          status: 'failed',
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(schemeGenerations.id, generation.id));

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }
}

// ============================================
// 默认生成方式
// ============================================

async function generateWithDefault(params: {
  chapterId: number;
  chapter: typeof bidChapters.$inferSelect;
  companyId?: number;
  tags: string[];
  project: typeof projects.$inferSelect | undefined;
  doc: typeof bidDocuments.$inferSelect | undefined;
  company: { id: number; name: string; shortName?: string | null } | null;
  requirements: string[];
  useKnowledge: boolean;
  customHeaders: Record<string, string>;
  llm: ReturnType<typeof getLLM>;
  userId: number;
  stream: boolean;
}): Promise<Response> {
  const {
    chapterId,
    chapter,
    companyId,
    tags,
    project,
    doc,
    company,
    requirements,
    useKnowledge,
    customHeaders,
    llm,
    userId,
    stream,
  } = params;

  // 检索相关知识
  let referenceContent: string[] = [];
  if (useKnowledge) {
    const knowledge = await retrieveRelevantKnowledge(
      chapter.title,
      3,
      customHeaders
    );
    referenceContent = knowledge.map((k) => k.content);
  }

  // 构建系统提示词
  const systemPrompt = `你是一个专业的标书编写专家。请根据给定的要求生成标书章节内容。

注意事项：
1. 内容要具体、可操作，避免空泛表述
2. 使用专业术语，但不要过于晦涩
3. 适当使用列表、表格等格式增强可读性
4. 确保内容与招标要求对应
5. 突出企业优势和解决方案亮点${company ? `\n6. 当前撰写方为"${company.name}"，请结合该公司情况撰写` : ''}`;

  let userPrompt = `请为以下标书章节生成内容：

项目名称：${project?.name || ''}
文档名称：${doc?.name || ''}
章节标题：${chapter.title}
${chapter.type ? `章节类型：${chapter.type}` : ''}${company ? `\n撰写方：${company.name}` : ''}`;

  if (requirements.length > 0) {
    userPrompt += `\n\n招标要求：\n${requirements.map((r) => `- ${r}`).join('\n')}`;
  }

  if (referenceContent.length > 0) {
    userPrompt += `\n\n参考内容：\n${referenceContent.join('\n\n')}`;
  }

  userPrompt += '\n\n请生成完整的章节内容：';

  // 更新章节的公司和标签
  await db
    .update(bidChapters)
    .set({
      companyId: companyId || null,
      tags: JSON.stringify(tags),
      updatedAt: new Date(),
    })
    .where(eq(bidChapters.id, chapterId));

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  if (stream) {
    return createStreamResponse(async (controller, encoder) => {
      let fullContent = '';

      try {
        for await (const chunk of llm.generateStream(messages, { temperature: 0.7 })) {
          if (chunk.content) {
            fullContent += chunk.content;
            controller.enqueue(encoder.encodeText(chunk.content));
          }
          if (chunk.done) {
            controller.enqueue(encoder.encode({
              type: 'complete',
              wordCount: fullContent.length,
            }));
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '生成失败';
        controller.enqueue(encoder.encodeError(errorMessage));
      }
    });
  } else {
    try {
      const result = await llm.generate(messages, { temperature: 0.7 });
      return NextResponse.json({
        success: true,
        content: result.content,
        usage: result.usage,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }
}

// ============================================
// GET: 获取可用的提示词模板列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const keyword = searchParams.get('keyword');

    // 构建查询条件
    const conditions = [eq(promptTemplates.status, 'active')];
    
    if (categoryId) {
      conditions.push(eq(promptTemplates.categoryId, parseInt(categoryId)));
    }

    // 查询模板
    let query = db
      .select({
        id: promptTemplates.id,
        name: promptTemplates.name,
        code: promptTemplates.code,
        description: promptTemplates.description,
        categoryId: promptTemplates.categoryId,
        modelProvider: promptTemplates.modelProvider,
        modelName: promptTemplates.modelName,
        outputFormat: promptTemplates.outputFormat,
        useCount: promptTemplates.useCount,
      })
      .from(promptTemplates)
      .where(eq(promptTemplates.status, 'active'))
      .orderBy(asc(promptTemplates.name));

    const templates = await query;

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json(
      { error: '获取模板列表失败' },
      { status: 500 }
    );
  }
}

// 辅助函数：获取嵌套对象值
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

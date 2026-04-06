/**
 * AI辅助编标服务
 * 提供内容生成、优化、扩充等功能
 * 
 * 已迁移至统一LLM适配层，支持多种部署方式
 */

import { db } from '@/db';
import { bidChapters as _bidChapters, aiGenerationLogs, knowledgeItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { KnowledgeEmbeddingService } from '@/lib/embedding/service';
import {
  getLLM,
  getLLMByProvider as _getLLMByProvider,
  createCozeAdapterWithHeaders,
  ChatMessage,
  LLMAdapter,
} from '@/lib/llm';

// ============================================
// 类型定义
// ============================================

export interface GenerationContext {
  chapterTitle: string;
  chapterType?: string;
  documentName: string;
  projectName: string;
  requirements?: string[];
  referenceContent?: string[];
  interpretationContext?: string;
}

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxLength?: number;
  style?: 'formal' | 'technical' | 'concise';
}

export interface GenerationResult {
  content: string;
  wordCount: number;
  suggestions?: string[];
  references?: string[];
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取LLM适配器
 */
function getLLMAdapter(customHeaders?: Record<string, string>): LLMAdapter {
  if (customHeaders) {
    return createCozeAdapterWithHeaders(customHeaders);
  }
  return getLLM();
}

// ============================================
// AI生成服务
// ============================================

/**
 * 生成章节内容
 */
export async function generateChapterContent(
  context: GenerationContext,
  options: GenerationOptions = {},
  customHeaders?: Record<string, string>
): Promise<GenerationResult> {
  const llm = getLLMAdapter(customHeaders);

  const {
    chapterTitle,
    chapterType,
    documentName,
    projectName,
    requirements,
    referenceContent,
    interpretationContext,
  } = context;

  const {
    temperature = 0.7,
    style = 'formal',
  } = options;

  const styleGuide = {
    formal: '使用正式、专业的商务文书风格，语言严谨、规范',
    technical: '使用技术文档风格，注重技术细节和参数说明',
    concise: '使用简洁明了的风格，突出重点，避免冗余',
  };

  const systemPrompt = `你是一个专业的标书编写专家。请根据给定的要求生成标书章节内容。

写作要求：
${styleGuide[style]}

注意事项：
1. 内容要具体、可操作，避免空泛表述
2. 使用专业术语，但不要过于晦涩
3. 适当使用列表、表格等格式增强可读性
4. 确保内容与招标要求对应
5. 突出企业优势和解决方案亮点`;

  let userPrompt = `请为以下标书章节生成内容：

项目名称：${projectName}
文档名称：${documentName}
章节标题：${chapterTitle}
${chapterType ? `章节类型：${chapterType}` : ''}

`;

  if (requirements && requirements.length > 0) {
    userPrompt += `\n招标要求：\n${requirements.map((r) => `- ${r}`).join('\n')}\n`;
  }

  if (referenceContent && referenceContent.length > 0) {
    userPrompt += `\n参考内容：\n${referenceContent.join('\n\n')}\n`;
  }

  if (interpretationContext) {
    userPrompt += `\n${interpretationContext}\n`;
  }

  userPrompt += '\n请生成完整的章节内容：';

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const result = await llm.generate(messages, {
      model: options.model,
      temperature,
      maxTokens: options.maxLength,
    });

    const content = result.content;

    // 生成建议
    const suggestions = await generateSuggestions(content, context, customHeaders);

    return {
      content,
      wordCount: content.length,
      suggestions,
    };
  } catch (error) {
    console.error('Generate chapter content error:', error);
    throw error;
  }
}

/**
 * 优化现有内容
 */
export async function optimizeChapterContent(
  existingContent: string,
  optimizationType: 'expand' | 'simplify' | 'polish' | 'format',
  customHeaders?: Record<string, string>
): Promise<GenerationResult> {
  const llm = getLLMAdapter(customHeaders);

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

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${optimizationPrompts[optimizationType]}\n\n${existingContent}`,
      },
    ];

    const result = await llm.generate(messages, {
      temperature: 0.5,
    });

    return {
      content: result.content,
      wordCount: result.content.length,
    };
  } catch (error) {
    console.error('Optimize content error:', error);
    throw error;
  }
}

/**
 * 生成改进建议
 */
async function generateSuggestions(
  content: string,
  context: GenerationContext,
  customHeaders?: Record<string, string>
): Promise<string[]> {
  const llm = getLLMAdapter(customHeaders);

  const systemPrompt = `你是一个标书审核专家。请分析给定的章节内容，提出改进建议。

要求：
1. 建议3-5条具体的改进意见
2. 关注内容的完整性、专业性、针对性
3. 指出可能的不足或遗漏
4. 返回JSON数组格式`;

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `章节：${context.chapterTitle}\n\n内容：\n${content}\n\n请提出改进建议（JSON数组格式）：`,
      },
    ];

    const result = await llm.generate(messages, {
      temperature: 0.3,
    });

    const jsonMatch = result.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as string[];
    }

    return [];
  } catch (error) {
    console.error('Generate suggestions error:', error);
    return [];
  }
}

/**
 * 从知识库检索相关内容
 */
export async function retrieveRelevantKnowledge(
  query: string,
  topK: number = 5,
  customHeaders?: Record<string, string>
): Promise<Array<{ id: number; title: string; content: string; score: number }>> {
  // 获取已审核的知识条目
  const items = await db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.status, 'approved'));

  if (items.length === 0) {
    return [];
  }

  // 使用向量搜索
  const embeddingService = new KnowledgeEmbeddingService({ customHeaders });
  const results = await embeddingService.searchSimilarKnowledge(
    query,
    items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      embeddingVector: item.embeddingVector,
    })),
    topK
  );

  return results.map((r) => ({
    id: r.id,
    title: r.content.split('\n')[0] || '',
    content: r.content,
    score: r.score,
  }));
}

/**
 * 保存AI生成记录
 */
export async function saveGenerationLog(params: {
  chapterId: number;
  prompt: string;
  model: string;
  generatedContent: string;
  isAccepted: boolean;
  feedback?: string;
  userId: number;
}): Promise<void> {
  await db.insert(aiGenerationLogs).values({
    chapterId: params.chapterId,
    prompt: params.prompt,
    model: params.model,
    generatedContent: params.generatedContent,
    isAccepted: params.isAccepted,
    feedback: params.feedback || null,
    generatedBy: params.userId,
  });
}

/**
 * 流式生成章节内容
 */
export async function* generateChapterContentStream(
  context: GenerationContext,
  options: GenerationOptions = {},
  customHeaders?: Record<string, string>
): AsyncGenerator<string> {
  const llm = getLLMAdapter(customHeaders);

  const {
    chapterTitle,
    documentName,
    projectName,
    requirements,
  } = context;

  const systemPrompt = `你是一个专业的标书编写专家。请根据给定的要求生成标书章节内容。
使用正式、专业的商务文书风格，语言严谨、规范。`;

  let userPrompt = `请为以下标书章节生成内容：

项目名称：${projectName}
文档名称：${documentName}
章节标题：${chapterTitle}`;

  if (requirements && requirements.length > 0) {
    userPrompt += `\n\n招标要求：\n${requirements.map((r) => `- ${r}`).join('\n')}`;
  }

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const stream = llm.generateStream(messages, {
      model: options.model,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxLength,
    });

    for await (const chunk of stream) {
      if (!chunk.done && chunk.content) {
        yield chunk.content;
      }
    }
  } catch (error) {
    console.error('Stream generation error:', error);
    throw error;
  }
}

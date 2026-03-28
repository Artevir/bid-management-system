/**
 * 知识库导入服务
 * 支持从文档、URL等导入知识条目
 */

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { knowledgeItems, knowledgeCategories, knowledgeVersions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { KnowledgeEmbeddingService } from '@/lib/embedding/service';

// ============================================
// 类型定义
// ============================================

export interface KnowledgeImportParams {
  categoryId: number;
  title: string;
  content: string;
  source?: string;
  sourceUrl?: string;
  keywords?: string[];
  userId: number;
  customHeaders?: Record<string, string>;
}

export interface KnowledgeExtractResult {
  title: string;
  content: string;
  summary: string;
  keywords: string[];
  category?: string;
}

export interface BatchImportResult {
  success: number;
  failed: number;
  items: Array<{
    title: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

// ============================================
// 知识提取服务
// ============================================

/**
 * 使用LLM从文档中提取知识点
 */
export async function extractKnowledgeFromDocument(
  documentContent: string,
  customHeaders?: Record<string, string>
): Promise<KnowledgeExtractResult[]> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const systemPrompt = `你是知识提取专家。请从文档中提取有价值的知识点，返回JSON数组。

返回格式：
[
  {
    "title": "知识点标题",
    "content": "知识点详细内容",
    "summary": "摘要（100字以内）",
    "keywords": ["关键词1", "关键词2"],
    "category": "建议分类"
  }
]

要求：
1. 每个知识点应该独立、完整
2. 标题简洁明了
3. 内容详细具体
4. 提取3-5个关键词
5. 建议合适的分类`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请从以下文档中提取知识点：\n\n${documentContent}` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as KnowledgeExtractResult[];
    }

    throw new Error('无法解析知识点');
  } catch (error) {
    console.error('Extract knowledge error:', error);
    throw error;
  }
}

/**
 * 使用LLM从URL内容中提取知识点
 */
export async function extractKnowledgeFromUrl(
  url: string,
  customHeaders?: Record<string, string>
): Promise<KnowledgeExtractResult[]> {
  // 这里简化处理，实际应该先获取URL内容
  // 可以使用 fetch-url skill
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const systemPrompt = `你是知识提取专家。请根据URL推测可能的知识点结构，返回JSON数组。

返回格式：
[
  {
    "title": "知识点标题",
    "content": "知识点详细内容",
    "summary": "摘要",
    "keywords": ["关键词"],
    "category": "建议分类"
  }
]`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `URL: ${url}` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as KnowledgeExtractResult[];
    }

    throw new Error('无法解析知识点');
  } catch (error) {
    console.error('Extract knowledge from URL error:', error);
    throw error;
  }
}

// ============================================
// 知识导入服务
// ============================================

/**
 * 导入单个知识条目
 */
export async function importKnowledgeItem(
  params: KnowledgeImportParams
): Promise<number> {
  const {
    categoryId,
    title,
    content,
    source,
    sourceUrl,
    keywords,
    userId,
    customHeaders,
  } = params;

  // 1. 创建知识条目
  const [item] = await db
    .insert(knowledgeItems)
    .values({
      categoryId,
      title,
      content,
      keywords: keywords ? JSON.stringify(keywords) : null,
      source,
      sourceUrl,
      status: 'draft',
      authorId: userId,
    })
    .returning();

  // 2. 创建初始版本
  await db.insert(knowledgeVersions).values({
    itemId: item.id,
    version: 1,
    title,
    content,
    authorId: userId,
  });

  // 3. 生成向量嵌入（异步）
  const embeddingService = new KnowledgeEmbeddingService({ customHeaders });
  embeddingService
    .generateKnowledgeEmbedding(title, content)
    .then((embeddingVector) => {
      db.update(knowledgeItems)
        .set({ embeddingVector })
        .where(eq(knowledgeItems.id, item.id))
        .catch(console.error);
    })
    .catch(console.error);

  return item.id;
}

/**
 * 批量导入知识条目
 */
export async function batchImportKnowledge(
  items: Array<{
    categoryId: number;
    title: string;
    content: string;
    source?: string;
    sourceUrl?: string;
    keywords?: string[];
  }>,
  userId: number,
  customHeaders?: Record<string, string>
): Promise<BatchImportResult> {
  const result: BatchImportResult = {
    success: 0,
    failed: 0,
    items: [],
  };

  for (const item of items) {
    try {
      await importKnowledgeItem({
        ...item,
        userId,
        customHeaders,
      });
      result.success++;
      result.items.push({
        title: item.title,
        status: 'success',
      });
    } catch (error) {
      result.failed++;
      result.items.push({
        title: item.title,
        status: 'failed',
        error: error instanceof Error ? error.message : '导入失败',
      });
    }
  }

  return result;
}

/**
 * 从文档导入知识点
 */
export async function importFromDocument(
  documentContent: string,
  defaultCategoryId: number,
  userId: number,
  customHeaders?: Record<string, string>
): Promise<BatchImportResult> {
  // 1. 提取知识点
  const extractedItems = await extractKnowledgeFromDocument(
    documentContent,
    customHeaders
  );

  // 2. 批量导入
  const importItems = extractedItems.map((item) => ({
    categoryId: defaultCategoryId,
    title: item.title,
    content: item.content,
    keywords: item.keywords,
  }));

  return batchImportKnowledge(importItems, userId, customHeaders);
}

/**
 * 审核知识条目
 */
export async function reviewKnowledgeItem(
  itemId: number,
  status: 'approved' | 'rejected',
  reviewerId: number,
  reviewNotes?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    reviewerId,
    reviewedAt: new Date(),
  };

  await db
    .update(knowledgeItems)
    .set(updateData)
    .where(eq(knowledgeItems.id, itemId));
}

/**
 * 更新知识条目（创建新版本）
 */
export async function updateKnowledgeItem(
  itemId: number,
  data: {
    title?: string;
    content?: string;
    keywords?: string[];
  },
  userId: number,
  changeLog?: string,
  customHeaders?: Record<string, string>
): Promise<void> {
  // 1. 获取当前版本
  const current = await db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.id, itemId))
    .limit(1);

  if (current.length === 0) {
    throw new Error('知识条目不存在');
  }

  const newVersion = current[0].currentVersion + 1;

  // 2. 创建新版本
  await db.insert(knowledgeVersions).values({
    itemId,
    version: newVersion,
    title: data.title || current[0].title,
    content: data.content || current[0].content,
    changeLog,
    authorId: userId,
  });

  // 3. 更新主记录
  const updateData: Record<string, unknown> = {
    currentVersion: newVersion,
    updatedAt: new Date(),
  };

  if (data.title) updateData.title = data.title;
  if (data.content) updateData.content = data.content;
  if (data.keywords) updateData.keywords = JSON.stringify(data.keywords);

  await db.update(knowledgeItems).set(updateData).where(eq(knowledgeItems.id, itemId));

  // 4. 更新向量嵌入
  if (data.content || data.title) {
    const embeddingService = new KnowledgeEmbeddingService({ customHeaders });
    embeddingService
      .generateKnowledgeEmbedding(
        data.title || current[0].title,
        data.content || current[0].content
      )
      .then((embeddingVector) => {
        db.update(knowledgeItems)
          .set({ embeddingVector })
          .where(eq(knowledgeItems.id, itemId))
          .catch(console.error);
      })
      .catch(console.error);
  }
}

/**
 * 获取知识条目版本历史
 */
export async function getKnowledgeVersions(itemId: number) {
  const versions = await db
    .select()
    .from(knowledgeVersions)
    .where(eq(knowledgeVersions.itemId, itemId))
    .orderBy(knowledgeVersions.version);

  return versions;
}

/**
 * 文档解析服务
 * 使用LLM进行文档智能解析和信息抽取
 */

import { LLMClient, Config, HeaderUtils as _HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { parseTasks, parseResults, parseItems, files } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export type ParseTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ParseItemType = 'deadline' | 'qualification' | 'scoring_item' | 'technical_param' | 'commercial' | 'requirement';

export interface CreateParseTaskParams {
  projectId: number;
  fileId: number;
  type: 'full' | 'section' | 'custom';
  userId: number;
}

export interface ParseResultItem {
  type: ParseItemType;
  title: string;
  content: string;
  originalText?: string;
  pageNumber?: number;
  confidence: number;
  extraData?: Record<string, unknown>;
}

export interface DocumentParseResult {
  sections: {
    title: string;
    content: string;
    pageNumber?: number;
  }[];
  items: ParseResultItem[];
}

// ============================================
// LLM 解析服务
// ============================================

/**
 * 使用LLM解析文档内容
 */
export async function parseDocumentWithLLM(
  documentContent: string,
  _parseType: 'full' | 'section' | 'custom' = 'full',
  customHeaders?: Record<string, string>
): Promise<DocumentParseResult> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = `你是一个专业的招标文件解析专家。你的任务是从招标文件中提取关键信息。

请按照以下格式返回JSON结果：
{
  "sections": [
    {
      "title": "章节标题",
      "content": "章节内容摘要",
      "pageNumber": 页码（如果有）
    }
  ],
  "items": [
    {
      "type": "deadline|qualification|scoring_item|technical_param|commercial|requirement",
      "title": "条目标题",
      "content": "条目内容",
      "originalText": "原文引用",
      "pageNumber": 页码,
      "confidence": 置信度(0-100),
      "extraData": {}
    }
  ]
}

类型说明：
- deadline: 时间节点（投标截止日期、开标日期等）
- qualification: 资格条件（资质要求、业绩要求等）
- scoring_item: 评分项（技术评分、商务评分项）
- technical_param: 技术参数（技术规格、参数要求）
- commercial: 商务条款（付款方式、交货期等）
- requirement: 其他要求

请仔细阅读文档，提取所有关键信息。注意：
1. 时间节点要精确到具体日期和时间
2. 资格条件要区分必须满足的和加分项
3. 评分项要标注分值
4. 技术参数要注明是否为关键参数
5. 对不确定的内容，降低置信度`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请解析以下招标文件内容：\n\n${documentContent}` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });

    // 解析JSON响应
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as DocumentParseResult;
    }

    throw new Error('无法解析LLM响应');
  } catch (error) {
    console.error('LLM parse error:', error);
    throw error;
  }
}

/**
 * 流式解析文档（用于大文档）
 */
export async function* parseDocumentStream(
  documentContent: string,
  customHeaders?: Record<string, string>
): AsyncGenerator<string> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = `你是一个专业的招标文件解析专家。请逐步分析文档内容，提取关键信息。

请按照以下步骤输出：
1. 首先识别文档结构和主要章节
2. 提取时间节点信息
3. 提取资格条件
4. 提取评分项
5. 提取技术参数和商务条款
6. 总结其他重要要求

每一步输出后换行，使用清晰的标题分隔。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请逐步分析以下招标文件：\n\n${documentContent}` },
  ];

  try {
    const stream = client.stream(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        yield chunk.content.toString();
      }
    }
  } catch (error) {
    console.error('Stream parse error:', error);
    throw error;
  }
}

// ============================================
// 解析任务管理
// ============================================

/**
 * 创建解析任务
 */
export async function createParseTask(params: CreateParseTaskParams): Promise<number> {
  const { projectId, fileId, type, userId } = params;

  // 检查是否存在相同文件的解析任务
  const existing = await db
    .select()
    .from(parseTasks)
    .where(and(eq(parseTasks.fileId, fileId), eq(parseTasks.status, 'pending')))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const result = await db
    .insert(parseTasks)
    .values({
      projectId,
      fileId,
      type,
      status: 'pending',
      progress: 0,
      createdBy: userId,
    })
    .returning({ id: parseTasks.id });

  return result[0].id;
}

/**
 * 获取解析任务详情
 */
export async function getParseTask(taskId: number) {
  const task = await db
    .select({
      id: parseTasks.id,
      projectId: parseTasks.projectId,
      fileId: parseTasks.fileId,
      type: parseTasks.type,
      status: parseTasks.status,
      progress: parseTasks.progress,
      totalPages: parseTasks.totalPages,
      processedPages: parseTasks.processedPages,
      errorMessage: parseTasks.errorMessage,
      startedAt: parseTasks.startedAt,
      completedAt: parseTasks.completedAt,
      createdAt: parseTasks.createdAt,
      fileName: files.originalName,
    })
    .from(parseTasks)
    .leftJoin(files, eq(parseTasks.fileId, files.id))
    .where(eq(parseTasks.id, taskId))
    .limit(1);

  return task[0] || null;
}

/**
 * 获取项目的解析任务列表
 */
export async function getProjectParseTasks(projectId: number) {
  const tasks = await db
    .select({
      id: parseTasks.id,
      projectId: parseTasks.projectId,
      fileId: parseTasks.fileId,
      type: parseTasks.type,
      status: parseTasks.status,
      progress: parseTasks.progress,
      totalPages: parseTasks.totalPages,
      processedPages: parseTasks.processedPages,
      errorMessage: parseTasks.errorMessage,
      startedAt: parseTasks.startedAt,
      completedAt: parseTasks.completedAt,
      createdAt: parseTasks.createdAt,
      fileName: files.originalName,
    })
    .from(parseTasks)
    .leftJoin(files, eq(parseTasks.fileId, files.id))
    .where(eq(parseTasks.projectId, projectId))
    .orderBy(desc(parseTasks.createdAt));

  return tasks;
}

/**
 * 更新解析任务状态
 */
export async function updateParseTaskStatus(
  taskId: number,
  status: ParseTaskStatus,
  progress?: number,
  errorMessage?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (progress !== undefined) {
    updateData.progress = progress;
  }

  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  if (status === 'processing' && !updateData.startedAt) {
    updateData.startedAt = new Date();
  }

  if (status === 'completed' || status === 'failed') {
    updateData.completedAt = new Date();
  }

  await db.update(parseTasks).set(updateData).where(eq(parseTasks.id, taskId));
}

/**
 * 保存解析结果
 */
export async function saveParseResults(
  taskId: number,
  results: DocumentParseResult
): Promise<void> {
  // 保存章节结果
  for (const section of results.sections) {
    await db.insert(parseResults).values({
      taskId,
      sectionTitle: section.title,
      sectionType: 'text',
      pageNumber: section.pageNumber,
      content: section.content,
      summary: section.content.substring(0, 500),
      confidence: 100,
    });
  }

  // 保存解析项
  for (const item of results.items) {
    await db.insert(parseItems).values({
      taskId,
      type: item.type,
      title: item.title,
      content: item.content,
      originalText: item.originalText,
      pageNumber: item.pageNumber,
      confidence: item.confidence,
      isLowConfidence: item.confidence < 80,
      extraData: item.extraData ? JSON.stringify(item.extraData) : null,
    });
  }
}

/**
 * 获取解析任务的解析项列表
 */
export async function getParseItems(
  taskId: number,
  type?: ParseItemType,
  lowConfidenceOnly?: boolean
) {
  const conditions = [eq(parseItems.taskId, taskId)];

  if (type) {
    conditions.push(eq(parseItems.type, type));
  }

  if (lowConfidenceOnly) {
    conditions.push(eq(parseItems.isLowConfidence, true));
  }

  const items = await db
    .select()
    .from(parseItems)
    .where(and(...conditions))
    .orderBy(desc(parseItems.createdAt));

  return items.map((item) => ({
    ...item,
    extraData: item.extraData ? JSON.parse(item.extraData) : null,
  }));
}

/**
 * 确认解析项
 */
export async function confirmParseItem(
  itemId: number,
  userId: number,
  correctedContent?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    isConfirmed: true,
    confirmedBy: userId,
    confirmedAt: new Date(),
    updatedAt: new Date(),
  };

  if (correctedContent) {
    updateData.content = correctedContent;
    updateData.confidence = 100;
    updateData.isLowConfidence = false;
  }

  await db.update(parseItems).set(updateData).where(eq(parseItems.id, itemId));
}

/**
 * 执行解析任务
 */
export async function executeParseTask(
  taskId: number,
  documentContent: string,
  customHeaders?: Record<string, string>
): Promise<void> {
  try {
    // 更新状态为处理中
    await updateParseTaskStatus(taskId, 'processing', 10);

    // 执行LLM解析
    const result = await parseDocumentWithLLM(documentContent, 'full', customHeaders);

    // 更新进度
    await updateParseTaskStatus(taskId, 'processing', 50);

    // 保存结果
    await saveParseResults(taskId, result);

    // 更新状态为完成
    await updateParseTaskStatus(taskId, 'completed', 100);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '解析失败';
    await updateParseTaskStatus(taskId, 'failed', 0, errorMessage);
    throw error;
  }
}

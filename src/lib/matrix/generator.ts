/**
 * 响应矩阵生成服务
 * 根据解析项自动生成响应矩阵
 */

import { LLMClient, Config, HeaderUtils as _HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { responseMatrices, responseItems, parseItems, parseTasks as _parseTasks } from '@/db/schema';
import { eq, and as _and } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface MatrixGenerationParams {
  projectId: number;
  taskId: number;
  name: string;
  description?: string;
  userId: number;
  customHeaders?: Record<string, string>;
}

export interface GeneratedMatrixItem {
  type: 'qualification' | 'scoring_item' | 'requirement';
  serialNumber: string;
  title: string;
  requirement: string;
  requirementType: 'mandatory' | 'optional';
  score: number | null;
  parseItemId: number;
  suggestedResponse?: string;
}

export interface MatrixGenerationResult {
  matrixId: number;
  totalItems: number;
  items: GeneratedMatrixItem[];
  statistics: {
    mandatoryCount: number;
    optionalCount: number;
    totalScore: number;
  };
}

// ============================================
// 矩阵生成服务
// ============================================

/**
 * 使用LLM生成响应建议
 */
export async function generateResponseSuggestion(
  requirement: string,
  context: string,
  customHeaders?: Record<string, string>
): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const systemPrompt = `你是一个专业的投标响应专家。根据招标文件的要求，生成合适的响应建议。

要求：
1. 响应内容要具体、可操作
2. 突出公司的优势和实力
3. 提供具体的数据和案例支持
4. 注意格式规范`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `招标要求：\n${requirement}\n\n上下文：\n${context}\n\n请生成响应建议：` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });

    return response.content;
  } catch (error) {
    console.error('Generate response suggestion error:', error);
    return '';
  }
}

/**
 * 生成响应矩阵
 */
export async function generateResponseMatrix(
  params: MatrixGenerationParams
): Promise<MatrixGenerationResult> {
  const { projectId, taskId, name, description, userId, _customHeaders } = params;

  // 1. 获取解析任务的解析项
  const taskParseItems = await db
    .select()
    .from(parseItems)
    .where(eq(parseItems.taskId, taskId));

  if (taskParseItems.length === 0) {
    throw new Error('解析任务没有解析项');
  }

  // 2. 创建响应矩阵
  const [matrix] = await db
    .insert(responseMatrices)
    .values({
      projectId,
      name,
      description: description || `基于解析任务 #${taskId} 自动生成`,
      status: 'draft',
      totalItems: 0,
      completedItems: 0,
      createdBy: userId,
    })
    .returning();

  // 3. 生成矩阵项
  const matrixItems: GeneratedMatrixItem[] = [];
  let serialNumber = 1;

  // 处理资格条件
  const qualifications = taskParseItems.filter((item) => item.type === 'qualification');
  for (const item of qualifications) {
    const extraData = item.extraData ? JSON.parse(item.extraData) : {};
    
    matrixItems.push({
      type: 'qualification',
      serialNumber: `Q${String(serialNumber++).padStart(2, '0')}`,
      title: item.title,
      requirement: item.content,
      requirementType: extraData.isRequired ? 'mandatory' : 'optional',
      score: null,
      parseItemId: item.id,
    });
  }

  // 处理评分项
  serialNumber = 1;
  const scoringItems = taskParseItems.filter((item) => item.type === 'scoring_item');
  for (const item of scoringItems) {
    const extraData = item.extraData ? JSON.parse(item.extraData) : {};
    
    matrixItems.push({
      type: 'scoring_item',
      serialNumber: `S${String(serialNumber++).padStart(2, '0')}`,
      title: item.title,
      requirement: item.content,
      requirementType: 'optional',
      score: extraData.maxScore || null,
      parseItemId: item.id,
    });
  }

  // 处理其他要求
  serialNumber = 1;
  const requirements = taskParseItems.filter(
    (item) => item.type === 'requirement' || item.type === 'technical_param' || item.type === 'commercial'
  );
  for (const item of requirements) {
    matrixItems.push({
      type: 'requirement',
      serialNumber: `R${String(serialNumber++).padStart(2, '0')}`,
      title: item.title,
      requirement: item.content,
      requirementType: 'optional',
      score: null,
      parseItemId: item.id,
    });
  }

  // 4. 保存矩阵项到数据库
  for (const item of matrixItems) {
    await db.insert(responseItems).values({
      matrixId: matrix.id,
      parseItemId: item.parseItemId,
      type: item.type,
      serialNumber: item.serialNumber,
      title: item.title,
      requirement: item.requirement,
      requirementType: item.requirementType,
      score: item.score,
      responseStatus: 'pending',
    });
  }

  // 5. 更新矩阵统计信息
  await db
    .update(responseMatrices)
    .set({
      totalItems: matrixItems.length,
    })
    .where(eq(responseMatrices.id, matrix.id));

  return {
    matrixId: matrix.id,
    totalItems: matrixItems.length,
    items: matrixItems,
    statistics: {
      mandatoryCount: matrixItems.filter((i) => i.requirementType === 'mandatory').length,
      optionalCount: matrixItems.filter((i) => i.requirementType === 'optional').length,
      totalScore: matrixItems.reduce((sum, i) => sum + (i.score || 0), 0),
    },
  };
}

/**
 * 批量生成响应建议
 */
export async function batchGenerateResponses(
  matrixId: number,
  itemIds: number[],
  customHeaders?: Record<string, string>
): Promise<void> {
  // 获取矩阵项
  const items = await db
    .select()
    .from(responseItems)
    .where(eq(responseItems.matrixId, matrixId));

  for (const item of items) {
    if (itemIds.length > 0 && !itemIds.includes(item.id)) {
      continue;
    }

    if (item.response) {
      continue; // 已有响应，跳过
    }

    // 生成响应建议
    const suggestion = await generateResponseSuggestion(
      item.requirement || '',
      item.title,
      customHeaders
    );

    if (suggestion) {
      await db
        .update(responseItems)
        .set({ response: suggestion })
        .where(eq(responseItems.id, item.id));
    }
  }
}

/**
 * 更新矩阵项响应
 */
export async function updateMatrixItemResponse(
  itemId: number,
  response: string,
  _userId: number
): Promise<void> {
  await db
    .update(responseItems)
    .set({
      response,
      responseStatus: 'responded',
      updatedAt: new Date(),
    })
    .where(eq(responseItems.id, itemId));
}

/**
 * 获取矩阵详情
 */
export async function getMatrixDetail(matrixId: number) {
  const matrix = await db
    .select()
    .from(responseMatrices)
    .where(eq(responseMatrices.id, matrixId))
    .limit(1);

  if (matrix.length === 0) {
    return null;
  }

  const items = await db
    .select()
    .from(responseItems)
    .where(eq(responseItems.matrixId, matrixId))
    .orderBy(responseItems.serialNumber);

  return {
    ...matrix[0],
    items,
  };
}

/**
 * 获取项目的响应矩阵列表
 */
export async function getProjectMatrices(projectId: number) {
  const matrices = await db
    .select()
    .from(responseMatrices)
    .where(eq(responseMatrices.projectId, projectId));

  return matrices;
}

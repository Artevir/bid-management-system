/**
 * AI图片生成服务
 * 提供图片生成功能，支持文生图、图生图、批量生成
 */

import { db } from '@/db';
import {
  imageGenerations,
  projects as _projects,
  bidDocuments as _bidDocuments,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  ImageGenerationClient,
  Config,
  HeaderUtils,
} from 'coze-coding-dev-sdk';

// ============================================
// 类型定义
// ============================================

export type ImageGenerationParams = {
  prompt: string;
  type?: 'text_to_image' | 'image_to_image' | 'batch_generation';
  size?: '2K' | '4K' | 'custom';
  customWidth?: number;
  customHeight?: number;
  watermark?: boolean;
  referenceImages?: string[];
  projectId?: number;
  projectName?: string;
  bidDocumentId?: number;
  businessObjectType?: 'project' | 'bid_document' | 'chapter' | 'marketing' | 'other';
  businessObjectId?: number;
  usage?: string;
  createdBy: number;
};

export type ImageGenerationResult = {
  id: number;
  imageUrls: string[];
  imageCount: number;
  status: string;
};

// ============================================
// 图片生成服务
// ============================================

/**
 * 生成图片
 */
export async function generateImage(
  params: ImageGenerationParams,
  headers?: Record<string, string>
): Promise<ImageGenerationResult> {
  const {
    prompt,
    type = 'text_to_image',
    size = '2K',
    customWidth,
    customHeight,
    watermark = true,
    referenceImages,
    projectId,
    projectName,
    bidDocumentId,
    businessObjectType,
    businessObjectId,
    usage,
    createdBy,
  } = params;

  // 构建尺寸参数
  let imageSize: string = size;
  if (size === 'custom' && customWidth && customHeight) {
    imageSize = `${customWidth}x${customHeight}`;
  }

  // 创建生成记录
  const [record] = await db
    .insert(imageGenerations)
    .values({
      type,
      prompt,
      size,
      customWidth,
      customHeight,
      watermark,
      referenceImages: referenceImages ? JSON.stringify(referenceImages) : null,
      imageUrls: '[]',
      imageCount: 0,
      projectId,
      projectName,
      bidDocumentId,
      businessObjectType,
      businessObjectId,
      usage,
      status: 'generating',
      createdBy,
    })
    .returning();

  try {
    // 初始化客户端
    const config = new Config();
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : {};
    const client = new ImageGenerationClient(config, customHeaders);

    // 构建请求参数
    const requestParams: any = {
      prompt,
      size: imageSize,
      watermark,
      responseFormat: 'url',
    };

    // 图生图：添加参考图片
    if (type === 'image_to_image' && referenceImages && referenceImages.length > 0) {
      requestParams.image = referenceImages;
    }

    // 生成图片
    const response = await client.generate(requestParams);
    const helper = client.getResponseHelper(response);

    if (!helper.success) {
      throw new Error(helper.errorMessages.join(', '));
    }

    // 更新记录
    await db
      .update(imageGenerations)
      .set({
        imageUrls: JSON.stringify(helper.imageUrls),
        imageCount: helper.imageUrls.length,
        status: 'completed',
      })
      .where(eq(imageGenerations.id, record.id));

    return {
      id: record.id,
      imageUrls: helper.imageUrls,
      imageCount: helper.imageUrls.length,
      status: 'completed',
    };
  } catch (error) {
    // 更新错误状态
    await db
      .update(imageGenerations)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '未知错误',
      })
      .where(eq(imageGenerations.id, record.id));

    throw error;
  }
}

/**
 * 批量生成图片
 */
export async function generateBatchImages(
  prompts: string[],
  commonParams: Omit<ImageGenerationParams, 'prompt'>,
  headers?: Record<string, string>
): Promise<ImageGenerationResult[]> {
  const results: ImageGenerationResult[] = [];

  for (const prompt of prompts) {
    try {
      const result = await generateImage(
        {
          ...commonParams,
          prompt,
          type: 'batch_generation',
        },
        headers
      );
      results.push(result);
    } catch (error) {
      console.error(`生成图片失败: ${prompt}`, error);
      results.push({
        id: 0,
        imageUrls: [],
        imageCount: 0,
        status: 'failed',
      });
    }
  }

  return results;
}

/**
 * 获取图片生成记录
 */
export async function getImageGeneration(id: number) {
  const [record] = await db.select().from(imageGenerations).where(eq(imageGenerations.id, id));

  if (!record) {
    return null;
  }

  return {
    ...record,
    imageUrls: JSON.parse(record.imageUrls),
    referenceImages: record.referenceImages ? JSON.parse(record.referenceImages) : null,
  };
}

/**
 * 获取图片生成列表
 */
export async function getImageGenerationList(params: {
  projectId?: number;
  bidDocumentId?: number;
  businessObjectType?: string;
  businessObjectId?: number;
  status?: string;
  createdBy?: number;
  page?: number;
  pageSize?: number;
}) {
  const {
    projectId,
    bidDocumentId,
    businessObjectType,
    businessObjectId,
    status,
    createdBy,
    page = 1,
    pageSize = 20,
  } = params;

  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const conditions = [];

  if (projectId) {
    conditions.push(eq(imageGenerations.projectId, projectId));
  }
  if (bidDocumentId) {
    conditions.push(eq(imageGenerations.bidDocumentId, bidDocumentId));
  }
  if (businessObjectType) {
    conditions.push(eq(imageGenerations.businessObjectType, businessObjectType as any));
  }
  if (businessObjectId) {
    conditions.push(eq(imageGenerations.businessObjectId, businessObjectId));
  }
  if (status) {
    conditions.push(eq(imageGenerations.status, status as any));
  }
  if (createdBy) {
    conditions.push(eq(imageGenerations.createdBy, createdBy));
  }

  // 查询记录
  const records = await db
    .select()
    .from(imageGenerations)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(imageGenerations.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 格式化返回数据
  return records.map((record) => ({
    ...record,
    imageUrls: JSON.parse(record.imageUrls),
    referenceImages: record.referenceImages ? JSON.parse(record.referenceImages) : null,
  }));
}

/**
 * 删除图片生成记录
 */
export async function deleteImageGeneration(id: number) {
  await db.delete(imageGenerations).where(eq(imageGenerations.id, id));
}

/**
 * 获取项目相关图片生成记录
 */
export async function getProjectImageGenerations(projectId: number) {
  const records = await db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.projectId, projectId))
    .orderBy(desc(imageGenerations.createdAt));

  return records.map((record) => ({
    ...record,
    imageUrls: JSON.parse(record.imageUrls),
    referenceImages: record.referenceImages ? JSON.parse(record.referenceImages) : null,
  }));
}

/**
 * 获取文档相关图片生成记录
 */
export async function getDocumentImageGenerations(bidDocumentId: number) {
  const records = await db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.bidDocumentId, bidDocumentId))
    .orderBy(desc(imageGenerations.createdAt));

  return records.map((record) => ({
    ...record,
    imageUrls: JSON.parse(record.imageUrls),
    referenceImages: record.referenceImages ? JSON.parse(record.referenceImages) : null,
  }));
}

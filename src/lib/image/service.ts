/**
 * 图片生成服务
 * 提供图片生成、管理等功能
 */

import { db } from '@/db';
import {
  images,
  imageCategories,
  imageTemplates,
  imageTypeEnum,
  generateModeEnum,
  imageStatusEnum,
  imageSizeEnum,
} from '@/db/image-schema';
import { eq, desc, asc, and, or, like, sql, inArray } from 'drizzle-orm';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// ============================================
// 类型定义
// ============================================

export type ImageType = typeof imageTypeEnum.enumValues[number];
export type GenerateMode = typeof generateModeEnum.enumValues[number];
export type ImageStatus = typeof imageStatusEnum.enumValues[number];
export type ImageSize = typeof imageSizeEnum.enumValues[number];

export interface GenerateImageOptions {
  prompt: string;
  imageType?: ImageType;
  generateMode?: GenerateMode;
  size?: ImageSize;
  customWidth?: number;
  customHeight?: number;
  style?: string;
  colorScheme?: string;
  agentId?: number;
  agentName?: string;
  projectId?: number;
  bidId?: number;
  userId?: number;
}

export interface GenerateImageResult {
  success: boolean;
  imageId?: number;
  imageUrl?: string;
  error?: string;
}

// ============================================
// 图片类型配置
// ============================================

// 导出常量（从独立文件导入，避免客户端构建问题）
export { IMAGE_TYPE_CONFIG } from './constants';
import { IMAGE_TYPE_CONFIG } from './constants';

// 尺寸映射
const SIZE_MAPPING: Record<ImageSize, string> = {
  '2K': '2K',
  '4K': '4K',
  'A4_LANDSCAPE': '2970x2100',
  'A4_PORTRAIT': '2100x2970',
  'A3_LANDSCAPE': '4200x2970',
  'A3_PORTRAIT': '2970x4200',
  'RATIO_16_9': '2560x1440',
  'RATIO_9_16': '1440x2560',
  'CUSTOM': '2K', // 自定义尺寸会使用customWidth/customHeight
};

// ============================================
// 图片生成服务
// ============================================

/**
 * 生成图片
 */
export async function generateImage(
  options: GenerateImageOptions,
  customHeaders?: Record<string, string>
): Promise<GenerateImageResult> {
  const startTime = Date.now();
  
  try {
    // 1. 创建图片记录（状态：生成中）
    const [imageRecord] = await db
      .insert(images)
      .values({
        name: `${IMAGE_TYPE_CONFIG[options.imageType || 'other']?.label || '图片'}_${Date.now()}`,
        imageType: (options.imageType || 'other') as any,
        generateMode: (options.generateMode || 'quick') as any,
        prompt: options.prompt,
        imageSize: (options.size || '2K') as any,
        customWidth: options.customWidth,
        customHeight: options.customHeight,
        style: options.style,
        colorScheme: options.colorScheme,
        agentId: options.agentId,
        agentName: options.agentName,
        projectId: options.projectId,
        bidId: options.bidId,
        status: 'generating',
        createdBy: options.userId,
      })
      .returning();

    // 2. 调用图片生成API
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    // 构建提示词
    const enhancedPrompt = buildEnhancedPrompt(options);

    // 确定尺寸
    let size: string;
    if (options.size === 'CUSTOM' && options.customWidth && options.customHeight) {
      size = `${options.customWidth}x${options.customHeight}`;
    } else {
      size = SIZE_MAPPING[options.size || '2K'];
    }

    // 调用生成API
    const response = await client.generate({
      prompt: enhancedPrompt,
      size,
      watermark: false,
    });

    const helper = client.getResponseHelper(response);

    if (!helper.success || helper.imageUrls.length === 0) {
      // 更新状态为失败
      await db
        .update(images)
        .set({
          status: 'failed',
          errorMessage: helper.errorMessages.join('; '),
          updatedAt: new Date(),
        })
        .where(eq(images.id, imageRecord.id));

      return {
        success: false,
        error: helper.errorMessages.join('; '),
      };
    }

    // 3. 更新图片记录（状态：已完成）
    const imageUrl = helper.imageUrls[0];
    const [updatedImage] = await db
      .update(images)
      .set({
        fileUrl: imageUrl,
        status: 'completed',
        format: 'png',
        updatedAt: new Date(),
      })
      .where(eq(images.id, imageRecord.id))
      .returning();

    return {
      success: true,
      imageId: updatedImage.id,
      imageUrl,
    };
  } catch (error: any) {
    console.error('图片生成失败:', error);
    return {
      success: false,
      error: error.message || '图片生成失败',
    };
  }
}

/**
 * 构建增强提示词
 */
function buildEnhancedPrompt(options: GenerateImageOptions): string {
  const typeConfig = IMAGE_TYPE_CONFIG[options.imageType || 'other'];
  
  // 基础提示词
  let prompt = options.prompt;
  
  // 添加类型信息
  if (typeConfig) {
    prompt = `[${typeConfig.label}] ${prompt}`;
  }
  
  // 添加风格
  if (options.style) {
    const styleMap: Record<string, string> = {
      '简洁商务': 'professional business style, clean and minimal, corporate design',
      '专业技术': 'technical professional style, detailed and precise, engineering design',
      '手绘示意': 'hand-drawn sketch style, illustrative, casual design',
    };
    prompt += `, ${styleMap[options.style] || options.style}`;
  }
  
  // 添加配色
  if (options.colorScheme) {
    prompt += `, ${options.colorScheme} color scheme`;
  }
  
  // 添加通用要求
  prompt += ', high quality, suitable for professional documents, clear and readable';
  
  return prompt;
}

// ============================================
// 图片查询服务
// ============================================

/**
 * 获取图片列表
 */
export async function getImageList(params?: {
  imageType?: ImageType;
  status?: ImageStatus;
  projectId?: number;
  createdBy?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  
  if (params?.imageType) {
    conditions.push(eq(images.imageType, params.imageType as any));
  }
  if (params?.status) {
    conditions.push(eq(images.status, params.status as any));
  }
  if (params?.projectId) {
    conditions.push(eq(images.projectId, params.projectId));
  }
  if (params?.createdBy) {
    conditions.push(eq(images.createdBy, params.createdBy));
  }
  if (params?.search) {
    conditions.push(or(
      like(images.name, `%${params.search}%`),
      like(images.description, `%${params.search}%`),
      like(images.prompt, `%${params.search}%`)
    ));
  }

  const query = db
    .select()
    .from(images)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(images.createdAt));

  if (params?.limit) {
    query.limit(params.limit);
  }
  if (params?.offset) {
    query.offset(params.offset);
  }

  return query;
}

/**
 * 获取图片详情
 */
export async function getImageById(imageId: number) {
  const [image] = await db
    .select()
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  return image || null;
}

/**
 * 更新图片信息
 */
export async function updateImage(imageId: number, data: {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  rating?: number;
  feedback?: string;
}) {
  const [image] = await db
    .update(images)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(images.id, imageId))
    .returning();

  return image;
}

/**
 * 删除图片
 */
export async function deleteImage(imageId: number) {
  await db.delete(images).where(eq(images.id, imageId));
  return true;
}

/**
 * 增加下载次数
 */
export async function incrementDownloadCount(imageId: number) {
  await db
    .update(images)
    .set({
      downloadCount: sql`${images.downloadCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(images.id, imageId));
}

// ============================================
// 图片分类服务
// ============================================

/**
 * 获取分类列表
 */
export async function getCategoryList(parentId?: number) {
  const conditions = [eq(imageCategories.isActive, true)];
  
  if (parentId !== undefined) {
    conditions.push(eq(imageCategories.parentId, parentId));
  }

  const categories = await db
    .select()
    .from(imageCategories)
    .where(and(...conditions))
    .orderBy(asc(imageCategories.sortOrder));

  return categories;
}

// ============================================
// 图片模板服务
// ============================================

/**
 * 获取模板列表
 */
export async function getTemplateList(imageType?: ImageType) {
  const conditions = [eq(imageTemplates.isPublic, true)];
  
  if (imageType) {
    conditions.push(eq(imageTemplates.imageType, imageType as any));
  }

  const templates = await db
    .select()
    .from(imageTemplates)
    .where(and(...conditions))
    .orderBy(desc(imageTemplates.isFeatured), desc(imageTemplates.useCount));

  return templates;
}

/**
 * 获取模板详情
 */
export async function getTemplateById(templateId: number) {
  const [template] = await db
    .select()
    .from(imageTemplates)
    .where(eq(imageTemplates.id, templateId))
    .limit(1);

  return template || null;
}

/**
 * LLM模型管理服务
 * 提供模型的增删改查、同步等功能
 */

import { db } from '@/db';
import { llmModels } from '@/db/llm-schema';
import { eq, desc, asc, and, or, like, sql, inArray } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export type ModelProvider = 'doubao' | 'deepseek' | 'qwen' | 'openai' | 'kimi' | 'glm' | 'custom';
export type ModelType = 'chat' | 'reasoning' | 'code' | 'image' | 'audio_tts' | 'audio_stt' | 'embedding' | 'moderation' | 'vision' | 'multimodal';
export type ModelStatus = 'active' | 'deprecated' | 'deprecated_soon' | 'inactive';

export interface ModelCreate {
  modelId: string;
  name: string;
  provider: ModelProvider;
  modelType?: ModelType;
  description?: string;
  tags?: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
  supportsFunctionCall?: boolean;
  supportsStreaming?: boolean;
  defaultTemperature?: string;
  supportsThinking?: boolean;
  supportsCaching?: boolean;
  pricingInput?: string;
  pricingOutput?: string;
  releaseDate?: string;
  deprecationDate?: string;
  officialDocUrl?: string;
  status?: ModelStatus;
  sortOrder?: number;
  isFeatured?: boolean;
  extraConfig?: Record<string, any>;
}

export interface ModelUpdate {
  name?: string;
  modelType?: ModelType;
  description?: string;
  tags?: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
  supportsFunctionCall?: boolean;
  supportsStreaming?: boolean;
  defaultTemperature?: string;
  supportsThinking?: boolean;
  supportsCaching?: boolean;
  pricingInput?: string;
  pricingOutput?: string;
  releaseDate?: string;
  deprecationDate?: string;
  officialDocUrl?: string;
  status?: ModelStatus;
  sortOrder?: number;
  isFeatured?: boolean;
  extraConfig?: Record<string, any>;
}

// ============================================
// 模型查询服务
// ============================================

/**
 * 获取所有可用模型
 */
export async function getAvailableModels(params?: {
  provider?: ModelProvider;
  modelType?: ModelType;
  status?: ModelStatus;
  includeInactive?: boolean;
}) {
  const conditions = [];
  
  if (params?.provider) {
    conditions.push(eq(llmModels.provider, params.provider as any));
  }
  if (params?.modelType) {
    conditions.push(eq(llmModels.modelType, params.modelType as any));
  }
  if (params?.status) {
    conditions.push(eq(llmModels.status, params.status as any));
  } else if (!params?.includeInactive) {
    // 默认只返回活跃和即将废弃的模型
    conditions.push(inArray(llmModels.status, ['active', 'deprecated_soon']));
  }

  const models = await db
    .select()
    .from(llmModels)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(llmModels.isFeatured), asc(llmModels.sortOrder), desc(llmModels.createdAt));

  return models;
}

/**
 * 根据模型ID获取模型详情
 */
export async function getModelById(modelId: string) {
  const [model] = await db
    .select()
    .from(llmModels)
    .where(eq(llmModels.modelId, modelId))
    .limit(1);

  return model || null;
}

/**
 * 根据提供商获取模型列表
 */
export async function getModelsByProvider(provider: ModelProvider) {
  const models = await db
    .select()
    .from(llmModels)
    .where(and(
      eq(llmModels.provider, provider as any),
      inArray(llmModels.status, ['active', 'deprecated_soon'])
    ))
    .orderBy(desc(llmModels.isFeatured), asc(llmModels.sortOrder));

  return models;
}

/**
 * 搜索模型
 */
export async function searchModels(query: string) {
  const models = await db
    .select()
    .from(llmModels)
    .where(or(
      like(llmModels.modelId, `%${query}%`),
      like(llmModels.name, `%${query}%`),
      like(llmModels.description, `%${query}%`)
    ))
    .orderBy(desc(llmModels.isFeatured), asc(llmModels.sortOrder));

  return models;
}

// ============================================
// 模型管理服务
// ============================================

/**
 * 创建模型
 */
export async function createModel(data: ModelCreate) {
  const [model] = await db
    .insert(llmModels)
    .values({
      modelId: data.modelId,
      name: data.name,
      provider: data.provider as any,
      modelType: (data.modelType || 'chat') as any,
      description: data.description,
      tags: data.tags || [],
      contextWindow: data.contextWindow,
      maxOutputTokens: data.maxOutputTokens || 4096,
      supportsVision: data.supportsVision || false,
      supportsFunctionCall: data.supportsFunctionCall ?? true,
      supportsStreaming: data.supportsStreaming ?? true,
      defaultTemperature: data.defaultTemperature || '0.7',
      supportsThinking: data.supportsThinking || false,
      supportsCaching: data.supportsCaching || false,
      pricingInput: data.pricingInput,
      pricingOutput: data.pricingOutput,
      releaseDate: data.releaseDate,
      deprecationDate: data.deprecationDate,
      officialDocUrl: data.officialDocUrl,
      status: (data.status || 'active') as any,
      sortOrder: data.sortOrder || 0,
      isFeatured: data.isFeatured || false,
      extraConfig: data.extraConfig || {},
    })
    .returning();

  return model;
}

/**
 * 批量创建模型
 */
export async function createModels(models: ModelCreate[]) {
  const result = await db
    .insert(llmModels)
    .values(models.map(data => ({
      modelId: data.modelId,
      name: data.name,
      provider: data.provider as any,
      modelType: (data.modelType || 'chat') as any,
      description: data.description,
      tags: data.tags || [],
      contextWindow: data.contextWindow,
      maxOutputTokens: data.maxOutputTokens || 4096,
      supportsVision: data.supportsVision || false,
      supportsFunctionCall: data.supportsFunctionCall ?? true,
      supportsStreaming: data.supportsStreaming ?? true,
      defaultTemperature: data.defaultTemperature || '0.7',
      supportsThinking: data.supportsThinking || false,
      supportsCaching: data.supportsCaching || false,
      pricingInput: data.pricingInput,
      pricingOutput: data.pricingOutput,
      releaseDate: data.releaseDate,
      deprecationDate: data.deprecationDate,
      officialDocUrl: data.officialDocUrl,
      status: (data.status || 'active') as any,
      sortOrder: data.sortOrder || 0,
      isFeatured: data.isFeatured || false,
      extraConfig: data.extraConfig || {},
    })))
    .returning();

  return result;
}

/**
 * 更新模型
 */
export async function updateModel(modelId: string, data: ModelUpdate) {
  const [model] = await db
    .update(llmModels)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(llmModels.modelId, modelId))
    .returning();

  return model;
}

/**
 * 删除模型
 */
export async function deleteModel(modelId: string) {
  await db.delete(llmModels).where(eq(llmModels.modelId, modelId));
  return true;
}

/**
 * 批量更新模型状态
 */
export async function updateModelsStatus(modelIds: string[], status: ModelStatus) {
  await db
    .update(llmModels)
    .set({ status: status as any, updatedAt: new Date() })
    .where(inArray(llmModels.modelId, modelIds));

  return true;
}

// ============================================
// 模型同步服务
// ============================================

/**
 * 同步厂商模型列表（占位实现，后续可对接各厂商API）
 */
export async function syncProviderModels(provider: ModelProvider): Promise<{
  added: number;
  updated: number;
  deprecated: number;
}> {
  // TODO: 对接各厂商API获取最新模型列表
  // 目前返回空结果，后续可扩展
  console.log(`[ModelSync] 同步 ${provider} 模型列表...`);
  
  return {
    added: 0,
    updated: 0,
    deprecated: 0,
  };
}

/**
 * 初始化默认模型数据
 */
export async function initializeDefaultModels() {
  // 检查是否已有模型数据
  const existing = await db.select().from(llmModels).limit(1);
  if (existing.length > 0) {
    console.log('[ModelInit] 模型数据已存在，跳过初始化');
    return;
  }

  const defaultModels: ModelCreate[] = [
    // ========================================
    // 豆包模型 (Doubao)
    // ========================================
    {
      modelId: 'doubao-seed-2-0-pro-260215',
      name: '豆包 Pro 2.0',
      provider: 'doubao',
      modelType: 'chat',
      description: '高性能旗舰模型',
      supportsThinking: true,
      isFeatured: true,
      sortOrder: 1,
    },
    {
      modelId: 'doubao-seed-2-0-lite-260215',
      name: '豆包 Lite 2.0',
      provider: 'doubao',
      modelType: 'chat',
      description: '轻量快速响应',
      sortOrder: 2,
    },
    {
      modelId: 'doubao-seed-2-0-mini-260215',
      name: '豆包 Mini 2.0',
      provider: 'doubao',
      modelType: 'chat',
      description: '极致轻量',
      sortOrder: 3,
    },
    {
      modelId: 'doubao-seed-1-6-vision-250815',
      name: '豆包 Vision',
      provider: 'doubao',
      modelType: 'vision',
      description: '多模态视觉理解',
      supportsVision: true,
      sortOrder: 4,
    },

    // ========================================
    // DeepSeek模型
    // ========================================
    {
      modelId: 'deepseek-v3-2-251201',
      name: 'DeepSeek V3.2',
      provider: 'deepseek',
      modelType: 'chat',
      description: '最新版本',
      isFeatured: true,
      sortOrder: 1,
    },
    {
      modelId: 'deepseek-r1-250528',
      name: 'DeepSeek R1',
      provider: 'deepseek',
      modelType: 'reasoning',
      description: '深度推理模型',
      supportsThinking: true,
      sortOrder: 2,
    },

    // ========================================
    // GLM模型 (智谱)
    // ========================================
    {
      modelId: 'glm-4-7-251222',
      name: 'GLM-4-7',
      provider: 'glm',
      modelType: 'chat',
      description: '智谱最新模型',
      sortOrder: 1,
    },

    // ========================================
    // Kimi模型 (月之暗面)
    // ========================================
    {
      modelId: 'kimi-k2-250905',
      name: 'Kimi K2',
      provider: 'kimi',
      modelType: 'chat',
      description: '长文本处理',
      sortOrder: 1,
    },
    {
      modelId: 'kimi-k2-5-260127',
      name: 'Kimi K2.5',
      provider: 'kimi',
      modelType: 'chat',
      description: '最新版本',
      isFeatured: true,
      sortOrder: 2,
    },

    // ========================================
    // OpenAI模型 - 对话模型
    // ========================================
    {
      modelId: 'gpt-5.4',
      name: 'GPT-5.4',
      provider: 'openai',
      modelType: 'chat',
      description: '最强通用模型',
      contextWindow: 128000,
      supportsThinking: true,
      isFeatured: true,
      sortOrder: 1,
    },
    {
      modelId: 'gpt-5.4-mini',
      name: 'GPT-5.4 Mini',
      provider: 'openai',
      modelType: 'chat',
      description: '最推荐生产主力',
      contextWindow: 128000,
      isFeatured: true,
      sortOrder: 2,
    },
    {
      modelId: 'gpt-5.4-nano',
      name: 'GPT-5.4 Nano',
      provider: 'openai',
      modelType: 'chat',
      description: '最低成本批处理',
      contextWindow: 128000,
      sortOrder: 3,
    },
    {
      modelId: 'o1-pro',
      name: 'O1 Pro',
      provider: 'openai',
      modelType: 'reasoning',
      description: '最强深推理',
      contextWindow: 200000,
      supportsThinking: true,
      isFeatured: true,
      sortOrder: 4,
    },
    {
      modelId: 'gpt-5.2',
      name: 'GPT-5.2',
      provider: 'openai',
      modelType: 'code',
      description: '最强代码/Agent',
      contextWindow: 128000,
      supportsFunctionCall: true,
      sortOrder: 5,
    },

    // ========================================
    // OpenAI模型 - 多模态
    // ========================================
    {
      modelId: 'gpt-image-1.5',
      name: 'GPT Image 1.5',
      provider: 'openai',
      modelType: 'image',
      description: '图片生成',
      sortOrder: 10,
    },
    {
      modelId: 'gpt-4o-mini-tts',
      name: 'GPT-4o Mini TTS',
      provider: 'openai',
      modelType: 'audio_tts',
      description: '语音合成',
      sortOrder: 11,
    },
    {
      modelId: 'gpt-4o-transcribe',
      name: 'GPT-4o Transcribe',
      provider: 'openai',
      modelType: 'audio_stt',
      description: '语音识别',
      sortOrder: 12,
    },

    // ========================================
    // OpenAI模型 - Embedding & 审核
    // ========================================
    {
      modelId: 'text-embedding-3-large',
      name: 'Text Embedding 3 Large',
      provider: 'openai',
      modelType: 'embedding',
      description: '向量检索',
      contextWindow: 8191,
      sortOrder: 20,
    },
    {
      modelId: 'omni-moderation-latest',
      name: 'Omni Moderation',
      provider: 'openai',
      modelType: 'moderation',
      description: '内容审核',
      sortOrder: 21,
    },
  ];

  await createModels(defaultModels);
  console.log(`[ModelInit] 初始化 ${defaultModels.length} 个默认模型`);
}

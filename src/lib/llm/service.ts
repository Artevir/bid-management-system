/**
 * LLM服务层
 * 提供模型配置、对话管理、API调用等功能
 */

import { db } from '@/db';
import {
  llmConfigs,
  llmConversations,
  llmMessages,
  llmCallLogs,
  llmPromptTemplates,
} from '@/db/llm-schema';
import { users } from '@/db/schema';
import { eq, desc, asc, and, like, sql } from 'drizzle-orm';
import { LLMClient, Config, type Message } from 'coze-coding-dev-sdk';

// ============================================
// 类型定义
// ============================================

export type LLMProvider = 'doubao' | 'deepseek' | 'qwen' | 'openai' | 'kimi' | 'glm' | 'custom';

export interface LLMConfigCreate {
  name: string;
  code?: string;
  description?: string;
  provider: LLMProvider;
  modelId: string;
  apiKey?: string;
  apiEndpoint?: string;
  apiVersion?: string;
  defaultTemperature?: string;
  maxTokens?: number;
  defaultThinking?: boolean;
  defaultCaching?: boolean;
  extraConfig?: Record<string, any>;
  scope?: string;
  createdBy: number;
}

export interface LLMConfigUpdate {
  name?: string;
  description?: string;
  modelId?: string;
  apiKey?: string;
  apiEndpoint?: string;
  defaultTemperature?: string;
  maxTokens?: number;
  defaultThinking?: boolean;
  defaultCaching?: boolean;
  extraConfig?: Record<string, any>;
  status?: 'active' | 'inactive' | 'error';
  isDefault?: boolean;
}

export interface ConversationCreate {
  title?: string;
  configId?: number;
  systemPrompt?: string;
  temperature?: string;
  thinking?: boolean;
  caching?: boolean;
  createdBy: number;
}

export interface MessageCreate {
  conversationId: number;
  role: 'system' | 'user' | 'assistant';
  content: string;
  contentType?: string;
  mediaUrls?: string[];
}

export interface ChatRequest {
  configId?: number;
  conversationId?: number;
  messages: Message[];
  model?: string;
  temperature?: number;
  thinking?: 'enabled' | 'disabled';
  caching?: 'enabled' | 'disabled';
  stream?: boolean;
}

// 模型映射表
const MODEL_MAPPING: Record<string, { provider: LLMProvider; name: string; description?: string }> = {
  // ========================================
  // 豆包模型 (Doubao)
  // ========================================
  'doubao-seed-2-0-pro-260215': { provider: 'doubao', name: '豆包 Pro 2.0', description: '高性能旗舰模型' },
  'doubao-seed-2-0-lite-260215': { provider: 'doubao', name: '豆包 Lite 2.0', description: '轻量快速响应' },
  'doubao-seed-2-0-mini-260215': { provider: 'doubao', name: '豆包 Mini 2.0', description: '极致轻量' },
  'doubao-seed-1-8-251228': { provider: 'doubao', name: '豆包 1.8', description: '稳定版本' },
  'doubao-seed-1-6-251015': { provider: 'doubao', name: '豆包 1.6', description: '平衡性能' },
  'doubao-seed-1-6-vision-250815': { provider: 'doubao', name: '豆包 Vision', description: '多模态视觉理解' },
  'doubao-seed-1-6-lite-251015': { provider: 'doubao', name: '豆包 Lite', description: '低成本选择' },

  // ========================================
  // DeepSeek模型
  // ========================================
  'deepseek-v3-2-251201': { provider: 'deepseek', name: 'DeepSeek V3.2', description: '最新版本' },
  'deepseek-r1-250528': { provider: 'deepseek', name: 'DeepSeek R1', description: '深度推理模型' },

  // ========================================
  // GLM模型 (智谱)
  // ========================================
  'glm-4-7-251222': { provider: 'glm', name: 'GLM-4-7', description: '智谱最新模型' },

  // ========================================
  // Kimi模型 (月之暗面)
  // ========================================
  'kimi-k2-250905': { provider: 'kimi', name: 'Kimi K2', description: '长文本处理' },
  'kimi-k2-5-260127': { provider: 'kimi', name: 'Kimi K2.5', description: '最新版本' },

  // ========================================
  // OpenAI模型
  // ========================================
  // --- 对话模型 ---
  'gpt-5.4': { provider: 'openai', name: 'GPT-5.4', description: '最强通用模型' },
  'gpt-5.4-mini': { provider: 'openai', name: 'GPT-5.4 Mini', description: '最推荐生产主力' },
  'gpt-5.4-nano': { provider: 'openai', name: 'GPT-5.4 Nano', description: '最低成本批处理' },
  'o1-pro': { provider: 'openai', name: 'O1 Pro', description: '最强深推理' },
  'gpt-5.2': { provider: 'openai', name: 'GPT-5.2', description: '最强代码/Agent' },

  // --- 多模态模型 ---
  'gpt-image-1.5': { provider: 'openai', name: 'GPT Image 1.5', description: '图片生成' },
  'gpt-4o-mini-tts': { provider: 'openai', name: 'GPT-4o Mini TTS', description: '语音合成' },
  'gpt-4o-transcribe': { provider: 'openai', name: 'GPT-4o Transcribe', description: '语音识别' },

  // --- Embedding & 审核 ---
  'text-embedding-3-large': { provider: 'openai', name: 'Text Embedding 3 Large', description: '向量检索' },
  'omni-moderation-latest': { provider: 'openai', name: 'Omni Moderation', description: '内容审核' },
};

// ============================================
// 配置管理服务
// ============================================

/**
 * 获取所有可用模型列表（动态加载）
 * 优先从数据库加载，失败时使用硬编码列表作为兜底
 */
export async function getAvailableModels() {
  try {
    // 动态导入模型服务，避免循环依赖
    const { getAvailableModels: getDbModels, initializeDefaultModels } = await import('./model-service');
    
    // 尝试从数据库获取模型
    let models = await getDbModels();
    
    // 如果数据库为空，初始化默认模型
    if (models.length === 0) {
      await initializeDefaultModels();
      models = await getDbModels();
    }
    
    return models.map((m) => ({
      id: m.modelId,
      provider: m.provider,
      name: m.name,
      description: m.description,
      modelType: m.modelType,
      supportsVision: m.supportsVision,
      supportsThinking: m.supportsThinking,
      isFeatured: m.isFeatured,
    }));
  } catch (error) {
    console.warn('[LLM Service] 从数据库加载模型失败，使用硬编码列表:', error);
    // 兜底：使用硬编码的模型列表
    return Object.entries(MODEL_MAPPING).map(([id, info]) => ({
      id,
      provider: info.provider,
      name: info.name,
      description: info.description,
    }));
  }
}

/**
 * 获取配置列表
 */
export async function getConfigList(params?: {
  provider?: LLMProvider;
  status?: string;
  createdBy?: number;
}) {
  const conditions = [];
  
  if (params?.provider) {
    conditions.push(eq(llmConfigs.provider, params.provider));
  }
  if (params?.status) {
    conditions.push(eq(llmConfigs.status, params.status as any));
  }
  if (params?.createdBy) {
    conditions.push(eq(llmConfigs.createdBy, params.createdBy));
  }

  const configs = await db
    .select({
      id: llmConfigs.id,
      name: llmConfigs.name,
      code: llmConfigs.code,
      description: llmConfigs.description,
      provider: llmConfigs.provider,
      modelId: llmConfigs.modelId,
      defaultTemperature: llmConfigs.defaultTemperature,
      maxTokens: llmConfigs.maxTokens,
      defaultThinking: llmConfigs.defaultThinking,
      defaultCaching: llmConfigs.defaultCaching,
      status: llmConfigs.status,
      isDefault: llmConfigs.isDefault,
      lastUsedAt: llmConfigs.lastUsedAt,
      scope: llmConfigs.scope,
      createdAt: llmConfigs.createdAt,
      creatorName: users.realName,
    })
    .from(llmConfigs)
    .leftJoin(users, eq(llmConfigs.createdBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(llmConfigs.isDefault), desc(llmConfigs.createdAt));

  return configs;
}

/**
 * 获取配置详情
 */
export async function getConfigById(configId: number) {
  const [config] = await db
    .select()
    .from(llmConfigs)
    .where(eq(llmConfigs.id, configId))
    .limit(1);

  return config || null;
}

/**
 * 获取默认配置
 */
export async function getDefaultConfig() {
  const [config] = await db
    .select()
    .from(llmConfigs)
    .where(and(eq(llmConfigs.isDefault, true), eq(llmConfigs.status, 'active')))
    .limit(1);

  return config || null;
}

/**
 * 创建配置
 */
export async function createConfig(data: LLMConfigCreate) {
  const [config] = await db
    .insert(llmConfigs)
    .values({
      name: data.name,
      code: data.code,
      description: data.description,
      provider: data.provider as any,
      modelId: data.modelId,
      apiKey: data.apiKey,
      apiEndpoint: data.apiEndpoint,
      apiVersion: data.apiVersion,
      defaultTemperature: data.defaultTemperature || '0.7',
      maxTokens: data.maxTokens || 4096,
      defaultThinking: data.defaultThinking || false,
      defaultCaching: data.defaultCaching || false,
      extraConfig: data.extraConfig || {},
      scope: data.scope || 'company',
      createdBy: data.createdBy,
    })
    .returning();

  return config;
}

/**
 * 更新配置
 */
export async function updateConfig(configId: number, data: LLMConfigUpdate) {
  const [config] = await db
    .update(llmConfigs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(llmConfigs.id, configId))
    .returning();

  return config;
}

/**
 * 删除配置
 */
export async function deleteConfig(configId: number) {
  await db.delete(llmConfigs).where(eq(llmConfigs.id, configId));
  return true;
}

/**
 * 设置默认配置
 */
export async function setDefaultConfig(configId: number) {
  // 先清除其他默认配置
  await db
    .update(llmConfigs)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(llmConfigs.isDefault, true));

  // 设置新的默认配置
  await db
    .update(llmConfigs)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(llmConfigs.id, configId));

  return true;
}

// ============================================
// 对话管理服务
// ============================================

/**
 * 创建对话
 */
export async function createConversation(data: ConversationCreate) {
  const [conversation] = await db
    .insert(llmConversations)
    .values({
      title: data.title || '新对话',
      configId: data.configId,
      systemPrompt: data.systemPrompt,
      temperature: data.temperature || '0.7',
      thinking: data.thinking || false,
      caching: data.caching || false,
      createdBy: data.createdBy,
    })
    .returning();

  return conversation;
}

/**
 * 获取对话列表
 */
export async function getConversationList(userId: number, limit = 20) {
  const conversations = await db
    .select({
      id: llmConversations.id,
      title: llmConversations.title,
      configId: llmConversations.id,
      configName: llmConfigs.name,
      modelName: llmConfigs.modelId,
      messageCount: llmConversations.messageCount,
      totalTokens: llmConversations.totalTokens,
      status: llmConversations.status,
      createdAt: llmConversations.createdAt,
      updatedAt: llmConversations.updatedAt,
    })
    .from(llmConversations)
    .leftJoin(llmConfigs, eq(llmConversations.configId, llmConfigs.id))
    .where(eq(llmConversations.createdBy, userId))
    .orderBy(desc(llmConversations.updatedAt))
    .limit(limit);

  return conversations;
}

/**
 * 获取对话详情（包含消息）
 */
export async function getConversationWithMessages(conversationId: number) {
  const [conversation] = await db
    .select()
    .from(llmConversations)
    .where(eq(llmConversations.id, conversationId))
    .limit(1);

  if (!conversation) return null;

  const messages = await db
    .select()
    .from(llmMessages)
    .where(eq(llmMessages.conversationId, conversationId))
    .orderBy(asc(llmMessages.createdAt));

  return { ...conversation, messages };
}

/**
 * 删除对话
 */
export async function deleteConversation(conversationId: number) {
  await db.delete(llmConversations).where(eq(llmConversations.id, conversationId));
  return true;
}

// ============================================
// 消息服务
// ============================================

/**
 * 添加消息
 */
export async function addMessage(data: MessageCreate) {
  const [message] = await db
    .insert(llmMessages)
    .values({
      conversationId: data.conversationId,
      role: data.role as any,
      content: data.content,
      contentType: data.contentType || 'text',
      mediaUrls: data.mediaUrls || [],
    })
    .returning();

  // 更新对话统计
  await db
    .update(llmConversations)
    .set({
      messageCount: sql`${llmConversations.messageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(llmConversations.id, data.conversationId));

  return message;
}

// ============================================
// LLM调用服务
// ============================================

/**
 * 执行对话（流式）
 */
export async function* streamChat(
  request: ChatRequest,
  customHeaders?: Record<string, string>
): AsyncGenerator<string> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const model = request.model || 'doubao-seed-1-8-251228';
  const temperature = request.temperature ?? 0.7;
  const thinking = request.thinking || 'disabled';
  const caching = request.caching || 'disabled';

  const stream = client.stream(request.messages, {
    model,
    temperature,
    thinking,
    caching,
  });

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content.toString();
    }
  }
}

/**
 * 执行对话（非流式）
 */
export async function invokeChat(
  request: ChatRequest,
  customHeaders?: Record<string, string>
): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const model = request.model || 'doubao-seed-1-8-251228';
  const temperature = request.temperature ?? 0.7;
  const thinking = request.thinking || 'disabled';
  const caching = request.caching || 'disabled';

  const response = await client.invoke(request.messages, {
    model,
    temperature,
    thinking,
    caching,
  });

  return response.content;
}

/**
 * 记录调用日志
 */
export async function logCall(data: {
  configId?: number;
  conversationId?: number;
  messageId?: number;
  modelId: string;
  provider: LLMProvider;
  inputTokens?: number;
  outputTokens?: number;
  latency?: number;
  firstTokenLatency?: number;
  status: string;
  errorMessage?: string;
  callContext?: Record<string, any>;
  createdBy?: number;
}) {
  const [log] = await db
    .insert(llmCallLogs)
    .values({
      configId: data.configId,
      conversationId: data.conversationId,
      messageId: data.messageId,
      modelId: data.modelId,
      provider: data.provider as any,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      latency: data.latency,
      firstTokenLatency: data.firstTokenLatency,
      status: data.status,
      errorMessage: data.errorMessage,
      callContext: data.callContext || {},
      createdBy: data.createdBy,
    })
    .returning();

  return log;
}

// ============================================
// 提示词模板服务
// ============================================

/**
 * 获取模板列表
 */
export async function getTemplateList(params?: { category?: string; isPublic?: boolean }) {
  const conditions = [];
  
  if (params?.category) {
    conditions.push(eq(llmPromptTemplates.category, params.category));
  }
  if (params?.isPublic !== undefined) {
    conditions.push(eq(llmPromptTemplates.isPublic, params.isPublic));
  }

  const templates = await db
    .select()
    .from(llmPromptTemplates)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(llmPromptTemplates.usageCount));

  return templates;
}

/**
 * 创建模板
 */
export async function createTemplate(data: {
  name: string;
  code?: string;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  variables?: any[];
  recommendedModel?: string;
  recommendedTemperature?: string;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  createdBy: number;
}) {
  const [template] = await db
    .insert(llmPromptTemplates)
    .values({
      name: data.name,
      code: data.code,
      description: data.description,
      systemPrompt: data.systemPrompt,
      userPromptTemplate: data.userPromptTemplate,
      variables: data.variables || [],
      recommendedModel: data.recommendedModel,
      recommendedTemperature: data.recommendedTemperature,
      category: data.category,
      tags: data.tags || [],
      isPublic: data.isPublic ?? true,
      createdBy: data.createdBy,
    })
    .returning();

  return template;
}

/**
 * 增加模板使用次数
 */
export async function incrementTemplateUsage(templateId: number) {
  await db
    .update(llmPromptTemplates)
    .set({
      usageCount: sql`${llmPromptTemplates.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(llmPromptTemplates.id, templateId));
}

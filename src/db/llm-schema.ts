/**
 * LLM配置管理数据库表结构
 * 支持多模型配置、对话历史、API调用日志
 */

import { pgTable, serial, varchar, text, integer, timestamp, boolean, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { users } from './schema';

// ============================================
// 枚举定义
// ============================================

/** 模型提供商枚举 */
export const llmProviderEnum = pgEnum('llm_provider', [
  'doubao',      // 豆包
  'deepseek',    // DeepSeek
  'qwen',        // 千问
  'openai',      // OpenAI
  'kimi',        // Kimi
  'glm',         // GLM
  'custom',      // 自定义
]);

/** 配置状态枚举 */
export const configStatusEnum = pgEnum('config_status', [
  'active',      // 启用
  'inactive',    // 禁用
  'error',       // 错误
]);

// ============================================
// LLM模型配置表
// ============================================

export const llmConfigs = pgTable('llm_configs', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  description: text('description'),
  
  // 提供商信息
  provider: llmProviderEnum('provider').notNull(),
  modelId: varchar('model_id', { length: 100 }).notNull(), // 模型ID，如 doubao-seed-1-8-251228
  
  // API配置
  apiKey: varchar('api_key', { length: 500 }), // 加密存储
  apiEndpoint: varchar('api_endpoint', { length: 500 }), // 自定义API地址
  apiVersion: varchar('api_version', { length: 50 }),
  
  // 模型参数
  defaultTemperature: varchar('default_temperature', { length: 10 }).default('0.7'),
  maxTokens: integer('max_tokens').default(4096),
  defaultThinking: boolean('default_thinking').default(false),
  defaultCaching: boolean('default_caching').default(false),
  
  // 高级配置
  extraConfig: jsonb('extra_config').default({}), // 额外配置JSON
  
  // 状态
  status: configStatusEnum('status').notNull().default('active'),
  isDefault: boolean('is_default').default(false),
  lastUsedAt: timestamp('last_used_at'),
  
  // 权限
  scope: varchar('scope', { length: 20 }).default('company'), // system/company/department/user
  departmentId: integer('department_id'),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// LLM模型注册表（动态模型配置）
// ============================================

/** 模型类型枚举 */
export const llmModelTypeEnum = pgEnum('llm_model_type', [
  'chat',          // 对话模型
  'reasoning',     // 推理模型
  'code',          // 代码模型
  'image',         // 图片生成
  'audio_tts',     // 语音合成
  'audio_stt',     // 语音识别
  'embedding',     // 向量嵌入
  'moderation',    // 内容审核
  'vision',        // 视觉理解
  'multimodal',    // 多模态
]);

/** 模型状态枚举 */
export const llmModelStatusEnum = pgEnum('llm_model_status', [
  'active',        // 可用
  'deprecated',    // 即将下架
  'deprecated_soon', // 即将废弃
  'inactive',      // 已下架
]);

export const llmModels = pgTable('llm_models', {
  id: serial('id').primaryKey(),
  
  // 模型标识
  modelId: varchar('model_id', { length: 100 }).notNull().unique(), // 如 gpt-5.4
  name: varchar('name', { length: 100 }).notNull(), // 显示名称
  provider: llmProviderEnum('provider').notNull(), // 提供商
  
  // 模型分类
  modelType: llmModelTypeEnum('model_type').notNull().default('chat'),
  description: text('description'), // 用途说明
  tags: jsonb('tags').default([]), // 标签，如 ['production', 'low-cost']
  
  // 技术规格
  contextWindow: integer('context_window'), // 上下文窗口大小
  maxOutputTokens: integer('max_output_tokens').default(4096), // 最大输出token
  supportsVision: boolean('supports_vision').default(false), // 支持视觉
  supportsFunctionCall: boolean('supports_function_call').default(true), // 支持函数调用
  supportsStreaming: boolean('supports_streaming').default(true), // 支持流式
  
  // 默认参数
  defaultTemperature: varchar('default_temperature', { length: 10 }).default('0.7'),
  supportsThinking: boolean('supports_thinking').default(false), // 是否支持思考模式
  supportsCaching: boolean('supports_caching').default(false), // 是否支持缓存
  
  // 定价信息（单位：美元/百万token）
  pricingInput: varchar('pricing_input', { length: 20 }), // 输入价格
  pricingOutput: varchar('pricing_output', { length: 20 }), // 输出价格
  
  // 厂商信息
  releaseDate: varchar('release_date', { length: 20 }), // 发布日期
  deprecationDate: varchar('deprecation_date', { length: 20 }), // 计划下架日期
  officialDocUrl: varchar('official_doc_url', { length: 500 }), // 官方文档链接
  
  // 状态与排序
  status: llmModelStatusEnum('status').notNull().default('active'),
  sortOrder: integer('sort_order').default(0), // 排序权重
  isFeatured: boolean('is_featured').default(false), // 是否推荐
  
  // 元数据
  extraConfig: jsonb('extra_config').default({}), // 额外配置
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// LLM对话会话表
// ============================================

export const llmConversations = pgTable('llm_conversations', {
  id: serial('id').primaryKey(),
  
  // 会话信息
  title: varchar('title', { length: 200 }),
  configId: integer('config_id').references(() => llmConfigs.id),
  
  // 系统提示
  systemPrompt: text('system_prompt'),
  
  // 参数
  temperature: varchar('temperature', { length: 10 }).default('0.7'),
  thinking: boolean('thinking').default(false),
  caching: boolean('caching').default(false),
  
  // 统计
  messageCount: integer('message_count').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalCost: varchar('total_cost', { length: 20 }).default('0'),
  
  // 状态
  status: varchar('status', { length: 20 }).default('active'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// LLM消息表
// ============================================

export const llmMessages = pgTable('llm_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => llmConversations.id, { onDelete: 'cascade' }),
  
  // 消息内容
  role: varchar('role', { length: 20 }).notNull(), // system/user/assistant
  content: text('content').notNull(),
  
  // 多模态内容
  contentType: varchar('content_type', { length: 20 }).default('text'), // text/image/video/mixed
  mediaUrls: jsonb('media_urls').default([]), // 图片/视频URL列表
  
  // 元数据
  tokens: integer('tokens'),
  latency: integer('latency'), // 响应时间(ms)
  
  // 缓存
  responseId: varchar('response_id', { length: 100 }), // 用于缓存的响应ID
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// LLM调用日志表
// ============================================

export const llmCallLogs = pgTable('llm_call_logs', {
  id: serial('id').primaryKey(),
  
  // 关联
  configId: integer('config_id').references(() => llmConfigs.id),
  conversationId: integer('conversation_id').references(() => llmConversations.id),
  messageId: integer('message_id').references(() => llmMessages.id),
  
  // 请求信息
  modelId: varchar('model_id', { length: 100 }).notNull(),
  provider: llmProviderEnum('provider').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  
  // 性能
  latency: integer('latency'), // 总耗时(ms)
  firstTokenLatency: integer('first_token_latency'), // 首token延迟(ms)
  
  // 状态
  status: varchar('status', { length: 20 }).notNull(), // success/failed/timeout
  errorMessage: text('error_message'),
  
  // 调用上下文
  callContext: jsonb('call_context').default({}), // 调用来源、业务场景等
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// LLM提示词模板表
// ============================================

export const llmPromptTemplates = pgTable('llm_prompt_templates', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  description: text('description'),
  
  // 模板内容
  systemPrompt: text('system_prompt'),
  userPromptTemplate: text('user_prompt_template'), // 支持变量替换 {{variable}}
  
  // 变量定义
  variables: jsonb('variables').default([]), // [{name, type, required, defaultValue}]
  
  // 推荐配置
  recommendedModel: varchar('recommended_model', { length: 100 }),
  recommendedTemperature: varchar('recommended_temperature', { length: 10 }),
  
  // 分类
  category: varchar('category', { length: 50 }), // 翻译/摘要/代码/分析等
  tags: jsonb('tags').default([]),
  
  // 状态
  status: varchar('status', { length: 20 }).default('active'),
  isPublic: boolean('is_public').default(true),
  
  // 统计
  usageCount: integer('usage_count').notNull().default(0),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

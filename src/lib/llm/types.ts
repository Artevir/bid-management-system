/**
 * 统一LLM接口类型定义
 * 支持多种部署方式：云端API、本地部署（Ollama/vLLM等）
 */

// ============================================
// 基础类型
// ============================================

/**
 * LLM提供商类型
 */
export type LLMProvider = 
  | 'coze' 
  | 'ollama' 
  | 'openai-compatible' 
  | 'deepseek'
  | 'qwen'
  | 'wenxin'
  | 'spark'
  | 'custom';

/**
 * 消息角色
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

/**
 * 生成选项
 */
export interface GenerateOptions {
  /** 模型标识 */
  model?: string;
  /** 温度参数 0-2 */
  temperature?: number;
  /** 最大生成token数 */
  maxTokens?: number;
  /** Top-p采样 */
  topP?: number;
  /** 停止词 */
  stop?: string[];
  /** 频率惩罚 */
  frequencyPenalty?: number;
  /** 存在惩罚 */
  presencePenalty?: number;
  /** 中断信号 */
  signal?: AbortSignal; // P1 优化：支持传入 AbortSignal 以便立即切断模型商连接
  /** 额外参数 */
  extra?: Record<string, unknown>;
}

/**
 * 生成结果
 */
export interface GenerateResult {
  /** 生成的内容 */
  content: string;
  /** 使用的token数 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 模型信息 */
  model?: string;
  /** 完成原因 */
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
  /** 额外信息 */
  extra?: Record<string, unknown>;
}

/**
 * 流式生成块
 */
export interface StreamChunk {
  /** 内容片段 */
  content: string;
  /** 是否完成 */
  done: boolean;
  /** 完成原因（仅done=true时有值） */
  finishReason?: GenerateResult['finishReason'];
  /** 使用量（仅done=true时有值） */
  usage?: GenerateResult['usage'];
  /** 额外信息 */
  extra?: Record<string, unknown>;
}

/**
 * Embedding选项
 */
export interface EmbeddingOptions {
  /** 模型标识 */
  model?: string;
  /** 向量维度 */
  dimensions?: number;
  /** 额外参数 */
  extra?: Record<string, unknown>;
}

/**
 * Embedding结果
 */
export interface EmbeddingResult {
  /** 向量数组 */
  embedding: number[];
  /** 使用的token数 */
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

// ============================================
// 提供商配置
// ============================================

/**
 * 基础提供商配置
 */
export interface BaseProviderConfig {
  /** 提供商类型 */
  provider: LLMProvider;
  /** 是否启用 */
  enabled?: boolean;
  /** 默认模型 */
  defaultModel?: string;
  /** 默认Embedding模型 */
  defaultEmbeddingModel?: string;
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 重试次数 */
  maxRetries?: number;
}

/**
 * Coze云端API配置
 */
export interface CozeProviderConfig extends BaseProviderConfig {
  provider: 'coze';
  /** 自定义请求头（用于认证） */
  customHeaders?: Record<string, string>;
}

/**
 * Ollama本地部署配置
 */
export interface OllamaProviderConfig extends BaseProviderConfig {
  provider: 'ollama';
  /** Ollama服务地址 */
  baseUrl?: string;
}

/**
 * OpenAI兼容配置（支持vLLM、LocalAI等）
 */
export interface OpenAICompatibleProviderConfig extends BaseProviderConfig {
  provider: 'openai-compatible';
  /** API基础地址 */
  baseUrl?: string;
  /** API密钥 */
  apiKey?: string;
  /** 组织ID */
  organization?: string;
}

/**
 * DeepSeek配置
 * DeepSeek使用OpenAI兼容API
 */
export interface DeepSeekProviderConfig extends BaseProviderConfig {
  provider: 'deepseek';
  /** API密钥 */
  apiKey?: string;
  /** API基础地址（默认：https://api.deepseek.com/v1） */
  baseUrl?: string;
}

/**
 * 千问(Qwen/通义千问)配置
 * 使用DashScope API或OpenAI兼容模式
 */
export interface QwenProviderConfig extends BaseProviderConfig {
  provider: 'qwen';
  /** API密钥（DashScope API Key） */
  apiKey?: string;
  /** 是否使用OpenAI兼容模式 */
  useOpenAICompatible?: boolean;
  /** API基础地址（OpenAI兼容模式默认：https://dashscope.aliyuncs.com/compatible-mode/v1） */
  baseUrl?: string;
}

/**
 * 百度文心一言配置
 * 使用百度智能云千帆平台API
 */
export interface WenxinProviderConfig extends BaseProviderConfig {
  provider: 'wenxin';
  /** API Key */
  apiKey?: string;
  /** Secret Key */
  apiSecret?: string;
  /** API基础地址（默认：https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat） */
  baseUrl?: string;
}

/**
 * 讯飞星火配置
 * 使用WebSocket协议
 */
export interface SparkProviderConfig extends BaseProviderConfig {
  provider: 'spark';
  /** AppID */
  appId?: string;
  /** API Key */
  apiKey?: string;
  /** API Secret */
  apiSecret?: string;
  /** WebSocket基础地址 */
  baseUrl?: string;
}

/**
 * 自定义提供商配置
 */
export interface CustomProviderConfig extends BaseProviderConfig {
  provider: 'custom';
  /** 自定义请求函数 */
  requestFn?: (messages: ChatMessage[], options: GenerateOptions) => Promise<GenerateResult>;
  /** 自定义流式请求函数 */
  streamFn?: (messages: ChatMessage[], options: GenerateOptions) => AsyncIterable<StreamChunk>;
  /** 自定义Embedding函数 */
  embeddingFn?: (text: string, options: EmbeddingOptions) => Promise<EmbeddingResult>;
}

/**
 * 所有提供商配置联合类型
 */
export type ProviderConfig = 
  | CozeProviderConfig 
  | OllamaProviderConfig 
  | OpenAICompatibleProviderConfig
  | DeepSeekProviderConfig
  | QwenProviderConfig
  | WenxinProviderConfig
  | SparkProviderConfig
  | CustomProviderConfig;

// ============================================
// 统一接口
// ============================================

/**
 * LLM适配器接口
 * 所有提供商必须实现此接口
 */
export interface LLMAdapter {
  /** 提供商名称 */
  readonly name: string;
  /** 提供商类型 */
  readonly provider: LLMProvider;
  
  /**
   * 检查服务是否可用
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * 获取可用模型列表
   */
  listModels(): Promise<string[]>;
  
  /**
   * 生成文本（非流式）
   */
  generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult>;
  
  /**
   * 生成文本（流式）
   */
  generateStream(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): AsyncIterable<StreamChunk>;
  
  /**
   * 生成Embedding向量
   */
  embed(
    text: string,
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult>;
  
  /**
   * 批量生成Embedding向量
   */
  embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]>;
}

// ============================================
// 配置管理
// ============================================

/**
 * LLM服务配置
 */
export interface LLMServiceConfig {
  /** 默认提供商 */
  defaultProvider: LLMProvider;
  /** 所有提供商配置 */
  providers: ProviderConfig[];
  /** 全局默认选项 */
  defaultOptions?: GenerateOptions;
  /** 全局默认Embedding选项 */
  defaultEmbeddingOptions?: EmbeddingOptions;
}

/**
 * 环境变量配置映射
 */
export interface LLMEnvConfig {
  /** LLM提供商类型 */
  LLM_PROVIDER?: LLMProvider;
  /** 默认模型 */
  LLM_DEFAULT_MODEL?: string;
  /** 默认Embedding模型 */
  LLM_EMBEDDING_MODEL?: string;
  
  // Coze配置
  COZE_CUSTOM_HEADERS?: string;
  
  // Ollama配置
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  
  // OpenAI兼容配置
  OPENAI_COMPATIBLE_BASE_URL?: string;
  OPENAI_COMPATIBLE_API_KEY?: string;
  OPENAI_COMPATIBLE_MODEL?: string;
  
  // DeepSeek配置
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  
  // 千问配置
  QWEN_API_KEY?: string;
  QWEN_BASE_URL?: string;
  QWEN_MODEL?: string;
  QWEN_USE_OPENAI_COMPATIBLE?: string;
}

// ============================================
// 预设模型配置
// ============================================

/**
 * 预设模型配置
 * 方便快速切换常用模型
 */
export const PRESET_MODELS = {
  // DeepSeek模型
  deepseek: {
    chat: 'deepseek-chat',
    coder: 'deepseek-coder',
    reasoning: 'deepseek-reasoner',
  },
  // 千问模型
  qwen: {
    turbo: 'qwen-turbo',
    plus: 'qwen-plus',
    max: 'qwen-max',
    long: 'qwen-long',
  },
  // Ollama常用模型
  ollama: {
    llama3: 'llama3',
    llama3_70b: 'llama3:70b',
    mistral: 'mistral',
    codellama: 'codellama',
    qwen2: 'qwen2',
    deepseek_v2: 'deepseek-v2',
  },
  // 默认模型映射
  defaults: {
    coze: 'doubao-seed-1-8-251228',
    ollama: 'llama3',
    'openai-compatible': 'gpt-4',
    deepseek: 'deepseek-chat',
    qwen: 'qwen-turbo',
  },
} as const;

/**
 * 模型别名映射
 * 简化模型切换
 */
export const MODEL_ALIASES: Record<string, { provider: LLMProvider; model: string }> = {
  // DeepSeek别名
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-coder': { provider: 'deepseek', model: 'deepseek-coder' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-reasoner' },
  
  // 千问别名
  'qwen-turbo': { provider: 'qwen', model: 'qwen-turbo' },
  'qwen-plus': { provider: 'qwen', model: 'qwen-plus' },
  'qwen-max': { provider: 'qwen', model: 'qwen-max' },
  'qwen-long': { provider: 'qwen', model: 'qwen-long' },
  
  // Ollama别名
  'llama3': { provider: 'ollama', model: 'llama3' },
  'mistral': { provider: 'ollama', model: 'mistral' },
  'codellama': { provider: 'ollama', model: 'codellama' },
  
  // Coze/豆包别名
  'doubao': { provider: 'coze', model: 'doubao-seed-1-8-251228' },
};

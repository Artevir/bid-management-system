/**
 * LLM工厂类
 * 统一创建和管理LLM适配器，支持自动选择和配置
 */

import {
  LLMAdapter,
  LLMProvider,
  ProviderConfig,
  LLMServiceConfig,
  CozeProviderConfig,
  OllamaProviderConfig,
  OpenAICompatibleProviderConfig,
  DeepSeekProviderConfig,
  QwenProviderConfig,
  WenxinProviderConfig,
  SparkProviderConfig,
} from './types';
import {
  CozeAdapter,
  OllamaAdapter,
  OpenAICompatibleAdapter,
  DeepSeekAdapter,
  QwenAdapter,
  WenxinAdapter,
  SparkAdapter,
} from './adapters';

// ============================================
// 环境变量解析
// ============================================

/**
 * 从环境变量解析提供商类型
 */
function parseProviderFromEnv(): LLMProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();
  
  if (provider === 'coze') return 'coze';
  if (provider === 'ollama') return 'ollama';
  if (provider === 'openai-compatible' || provider === 'openai') return 'openai-compatible';
  if (provider === 'deepseek') return 'deepseek';
  if (provider === 'qwen' || provider === 'tongyi') return 'qwen';
  if (provider === 'wenxin' || provider === 'ernie') return 'wenxin';
  if (provider === 'spark' || provider === 'xfyun') return 'spark';
  
  // 默认使用Coze云端API
  return 'coze';
}

/**
 * 从环境变量解析Coze配置
 */
function parseCozeConfigFromEnv(): CozeProviderConfig {
  const customHeadersStr = process.env.COZE_CUSTOM_HEADERS;
  let customHeaders: Record<string, string> | undefined;
  
  if (customHeadersStr) {
    try {
      customHeaders = JSON.parse(customHeadersStr);
    } catch {
      console.warn('Failed to parse COZE_CUSTOM_HEADERS');
    }
  }
  
  return {
    provider: 'coze',
    enabled: true,
    defaultModel: process.env.LLM_DEFAULT_MODEL || 'doubao-seed-1-8-251228',
    defaultEmbeddingModel: process.env.LLM_EMBEDDING_MODEL || 'doubao-embedding',
    customHeaders,
  };
}

/**
 * 从环境变量解析Ollama配置
 */
function parseOllamaConfigFromEnv(): OllamaProviderConfig {
  return {
    provider: 'ollama',
    enabled: true,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_MODEL || process.env.LLM_DEFAULT_MODEL || 'llama3',
    defaultEmbeddingModel: process.env.LLM_EMBEDDING_MODEL || 'nomic-embed-text',
  };
}

/**
 * 从环境变量解析OpenAI兼容配置
 */
function parseOpenAICompatibleConfigFromEnv(): OpenAICompatibleProviderConfig {
  return {
    provider: 'openai-compatible',
    enabled: true,
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL || 'http://localhost:8000/v1',
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    defaultModel: process.env.OPENAI_COMPATIBLE_MODEL || process.env.LLM_DEFAULT_MODEL || 'default',
    defaultEmbeddingModel: process.env.LLM_EMBEDDING_MODEL || 'default',
  };
}

/**
 * 从环境变量解析DeepSeek配置
 */
function parseDeepSeekConfigFromEnv(): DeepSeekProviderConfig {
  return {
    provider: 'deepseek',
    enabled: true,
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    defaultModel: process.env.DEEPSEEK_MODEL || process.env.LLM_DEFAULT_MODEL || 'deepseek-chat',
    defaultEmbeddingModel: process.env.LLM_EMBEDDING_MODEL || 'deepseek-embed',
  };
}

/**
 * 从环境变量解析千问(Qwen)配置
 */
function parseQwenConfigFromEnv(): QwenProviderConfig {
  return {
    provider: 'qwen',
    enabled: true,
    baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY,
    defaultModel: process.env.QWEN_MODEL || process.env.LLM_DEFAULT_MODEL || 'qwen-turbo',
    defaultEmbeddingModel: process.env.LLM_EMBEDDING_MODEL || 'text-embedding-v3',
  };
}

/**
 * 从环境变量解析文心一言配置
 */
function parseWenxinConfigFromEnv(): WenxinProviderConfig {
  return {
    provider: 'wenxin',
    enabled: true,
    apiKey: process.env.WENXIN_API_KEY,
    apiSecret: process.env.WENXIN_API_SECRET,
    defaultModel: process.env.WENXIN_MODEL || 'ernie-4.0-8k',
    defaultEmbeddingModel: 'embedding-v1',
  };
}

/**
 * 从环境变量解析讯飞星火配置
 */
function parseSparkConfigFromEnv(): SparkProviderConfig {
  return {
    provider: 'spark',
    enabled: true,
    appId: process.env.SPARK_APP_ID,
    apiKey: process.env.SPARK_API_KEY,
    apiSecret: process.env.SPARK_API_SECRET,
    defaultModel: process.env.SPARK_MODEL || 'spark-3.5',
  };
}

/**
 * 从环境变量自动解析配置
 */
function parseConfigFromEnv(): LLMServiceConfig {
  const defaultProvider = parseProviderFromEnv();
  const providers: ProviderConfig[] = [];
  
  // 添加Coze配置
  providers.push(parseCozeConfigFromEnv());
  
  // 添加Ollama配置
  providers.push(parseOllamaConfigFromEnv());
  
  // 添加OpenAI兼容配置
  providers.push(parseOpenAICompatibleConfigFromEnv());
  
  // 添加DeepSeek配置
  providers.push(parseDeepSeekConfigFromEnv());
  
  // 添加千问(Qwen)配置
  providers.push(parseQwenConfigFromEnv());
  
  // 添加文心一言配置
  providers.push(parseWenxinConfigFromEnv());
  
  // 添加讯飞星火配置
  providers.push(parseSparkConfigFromEnv());
  
  return {
    defaultProvider,
    providers,
  };
}

// ============================================
// 适配器创建
// ============================================

/**
 * 创建适配器实例
 */
function createAdapter(config: ProviderConfig): LLMAdapter {
  switch (config.provider) {
    case 'coze':
      return new CozeAdapter(config as CozeProviderConfig);
    case 'ollama':
      return new OllamaAdapter(config as OllamaProviderConfig);
    case 'openai-compatible':
      return new OpenAICompatibleAdapter(config as OpenAICompatibleProviderConfig);
    case 'deepseek':
      return new DeepSeekAdapter(config as DeepSeekProviderConfig);
    case 'qwen':
      return new QwenAdapter(config as QwenProviderConfig);
    case 'wenxin':
      return new WenxinAdapter(config as WenxinProviderConfig);
    case 'spark':
      return new SparkAdapter(config as SparkProviderConfig);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

// ============================================
// LLM工厂类
// ============================================

/**
 * LLM工厂类
 * 负责创建和管理LLM适配器实例
 */
export class LLMFactory {
  private static instance: LLMFactory | null = null;
  private adapters: Map<LLMProvider, LLMAdapter> = new Map();
  private config: LLMServiceConfig;
  private defaultAdapter: LLMAdapter | null = null;
  
  private constructor(config?: LLMServiceConfig) {
    this.config = config || parseConfigFromEnv();
    this.initializeAdapters();
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(config?: LLMServiceConfig): LLMFactory {
    if (!LLMFactory.instance) {
      LLMFactory.instance = new LLMFactory(config);
    }
    return LLMFactory.instance;
  }
  
  /**
   * 重置实例（用于测试或重新配置）
   */
  static reset(): void {
    LLMFactory.instance = null;
  }
  
  /**
   * 初始化适配器
   */
  private initializeAdapters(): void {
    for (const providerConfig of this.config.providers) {
      if (providerConfig.enabled !== false) {
        const adapter = createAdapter(providerConfig);
        this.adapters.set(providerConfig.provider, adapter);
        
        if (providerConfig.provider === this.config.defaultProvider) {
          this.defaultAdapter = adapter;
        }
      }
    }
    
    // 如果没有设置默认适配器，使用第一个可用的
    if (!this.defaultAdapter && this.adapters.size > 0) {
      this.defaultAdapter = this.adapters.values().next().value || null;
    }
  }
  
  /**
   * 获取默认适配器
   */
  getDefaultAdapter(): LLMAdapter {
    if (!this.defaultAdapter) {
      throw new Error('No default LLM adapter available');
    }
    return this.defaultAdapter;
  }
  
  /**
   * 获取指定提供商的适配器
   */
  getAdapter(provider: LLMProvider): LLMAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`LLM adapter not found for provider: ${provider}`);
    }
    return adapter;
  }
  
  /**
   * 获取所有可用的适配器
   */
  getAvailableAdapters(): Map<LLMProvider, LLMAdapter> {
    return new Map(this.adapters);
  }
  
  /**
   * 检查适配器是否可用
   */
  async isProviderAvailable(provider: LLMProvider): Promise<boolean> {
    const adapter = this.adapters.get(provider);
    if (!adapter) return false;
    return adapter.isAvailable();
  }
  
  /**
   * 自动选择最佳可用适配器
   * 按优先级检查适配器可用性，返回第一个可用的
   */
  async selectBestAvailable(): Promise<LLMAdapter> {
    // 首先检查默认适配器
    if (this.defaultAdapter && await this.defaultAdapter.isAvailable()) {
      return this.defaultAdapter;
    }
    
    // 检查其他适配器
    for (const [_, adapter] of this.adapters) {
      if (adapter !== this.defaultAdapter && await adapter.isAvailable()) {
        return adapter;
      }
    }
    
    // 如果都没有可用，返回默认适配器（可能在调用时报错）
    return this.getDefaultAdapter();
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): LLMServiceConfig {
    return { ...this.config };
  }
}

// ============================================
// 便捷函数
// ============================================

/**
 * 获取默认LLM适配器
 */
export function getLLM(): LLMAdapter {
  return LLMFactory.getInstance().getDefaultAdapter();
}

/**
 * 获取指定提供商的LLM适配器
 */
export function getLLMByProvider(provider: LLMProvider): LLMAdapter {
  return LLMFactory.getInstance().getAdapter(provider);
}

/**
 * 自动选择最佳可用的LLM适配器
 */
export async function getBestLLM(): Promise<LLMAdapter> {
  return LLMFactory.getInstance().selectBestAvailable();
}

/**
 * 检查LLM服务是否可用
 */
export async function isLLMAvailable(): Promise<boolean> {
  const factory = LLMFactory.getInstance();
  return factory.isProviderAvailable(factory.getConfig().defaultProvider);
}

// ============================================
// 请求头支持（用于Coze适配器）
// ============================================

/**
 * 从请求头提取转发头信息（用于Coze适配器）
 */
export function extractForwardHeaders(headers: Headers): Record<string, string> {
  const customHeaders: Record<string, string> = {};
  
  // 提取常见的转发头
  const forwardHeaders = [
    'authorization',
    'x-api-key',
    'x-request-id',
    'x-session-id',
    'cookie',
  ];
  
  for (const key of forwardHeaders) {
    const value = headers.get(key);
    if (value) {
      customHeaders[key] = value;
    }
  }
  
  return customHeaders;
}

/**
 * 创建带自定义头的适配器（用于Coze API）
 */
export function createCozeAdapterWithHeaders(
  customHeaders: Record<string, string>
): CozeAdapter {
  const config: CozeProviderConfig = {
    provider: 'coze',
    customHeaders,
    defaultModel: process.env.LLM_DEFAULT_MODEL || 'doubao-seed-1-8-251228',
    defaultEmbeddingModel: process.env.LLM_EMBEDDING_MODEL || 'doubao-embedding',
  };
  return new CozeAdapter(config);
}

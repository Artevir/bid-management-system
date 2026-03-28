/**
 * 百度文心一言适配器
 * 使用百度智能云千帆平台API
 * 文档: https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Nlks5zkzu
 */

import {
  LLMAdapter,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResult,
  WenxinProviderConfig,
} from '../types';

/**
 * 文心一言默认配置
 */
const DEFAULT_CONFIG: Partial<WenxinProviderConfig> = {
  baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
  defaultModel: 'ernie-4.0-8k',
  defaultEmbeddingModel: 'embedding-v1',
  timeout: 120000,
  maxRetries: 3,
};

/**
 * 文心一言可用模型
 */
const WENXIN_MODELS = {
  chat: [
    'ernie-4.0-8k',        // ERNIE 4.0
    'ernie-4.0-turbo-8k',  // ERNIE 4.0 Turbo
    'ernie-3.5-8k',        // ERNIE 3.5
    'ernie-3.5-128k',      // ERNIE 3.5 长上下文
    'ernie-speed-8k',      // ERNIE Speed
    'ernie-speed-128k',    // ERNIE Speed 长上下文
    'ernie-lite-8k',       // ERNIE Lite
  ],
  embedding: [
    'embedding-v1',
  ],
};

/**
 * 模型端点映射
 */
const MODEL_ENDPOINTS: Record<string, string> = {
  'ernie-4.0-8k': 'completions_pro',
  'ernie-4.0-turbo-8k': 'completions_pro',
  'ernie-3.5-8k': 'completions',
  'ernie-3.5-128k': 'ernie-3.5-128k',
  'ernie-speed-8k': 'ernie_speed',
  'ernie-speed-128k': 'ernie-speed-128k',
  'ernie-lite-8k': 'ernie-lite-8k',
  'embedding-v1': 'embeddings/embedding-v1',
};

/**
 * API响应类型
 */
interface WenxinChatResponse {
  id: string;
  object: string;
  created: number;
  result: string;
  is_truncated: boolean;
  need_clear_history: boolean;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface WenxinStreamChunk {
  id: string;
  object: string;
  created: number;
  result: string;
  is_end: boolean;
  is_truncated: boolean;
  need_clear_history: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface WenxinTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/**
 * 文心一言适配器实现
 */
export class WenxinAdapter implements LLMAdapter {
  readonly name = '文心一言 (Wenxin)';
  readonly provider = 'wenxin' as const;
  
  private config: WenxinProviderConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  
  constructor(config: WenxinProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 获取访问令牌
   */
  private async getAccessToken(): Promise<string> {
    // 如果令牌有效，直接返回
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // 获取新令牌
    const response = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.config.apiKey}&client_secret=${this.config.apiSecret}`,
      { method: 'POST' }
    );

    const data: WenxinTokenResponse = await response.json();
    
    if (data.error) {
      throw new Error(`获取访问令牌失败: ${data.error_description || data.error}`);
    }

    this.accessToken = data.access_token;
    // 提前5分钟过期
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    
    return this.accessToken;
  }
  
  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    return [...WENXIN_MODELS.chat, ...WENXIN_MODELS.embedding];
  }
  
  /**
   * 生成文本（非流式）
   */
  async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = options?.model || this.config.defaultModel || 'ernie-4.0-8k';
    
    try {
      const token = await this.getAccessToken();
      const endpoint = MODEL_ENDPOINTS[model] || 'completions';
      
      // 文心一言的消息格式
      const formattedMessages = messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role, // 文心一言不支持system角色
        content: m.content,
      }));

      const response = await fetch(
        `${this.config.baseUrl}/${endpoint}?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: formattedMessages,
            temperature: options?.temperature,
            max_output_tokens: options?.maxTokens,
            top_p: options?.topP,
            stream: false,
          }),
          signal: AbortSignal.timeout(this.config.timeout || 120000),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: '',
          finishReason: 'error',
          extra: { error: `Wenxin API error: ${response.status} ${errorText}` },
        };
      }
      
      const data: WenxinChatResponse = await response.json();
      
      // 映射完成原因
      let finishReason: GenerateResult['finishReason'] = 'stop';
      if (data.is_truncated) {
        finishReason = 'length';
      }
      
      return {
        content: data.result || '',
        model,
        finishReason,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        extra: {
          needClearHistory: data.need_clear_history,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        finishReason: 'error',
        extra: { error: errorMessage },
      };
    }
  }
  
  /**
   * 生成文本（流式）
   */
  async *generateStream(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): AsyncIterable<StreamChunk> {
    const model = options?.model || this.config.defaultModel || 'ernie-4.0-8k';
    
    try {
      const token = await this.getAccessToken();
      const endpoint = MODEL_ENDPOINTS[model] || 'completions';
      
      // 文心一言的消息格式
      const formattedMessages = messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      }));

      const response = await fetch(
        `${this.config.baseUrl}/${endpoint}?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: formattedMessages,
            temperature: options?.temperature,
            max_output_tokens: options?.maxTokens,
            top_p: options?.topP,
            stream: true,
          }),
          signal: AbortSignal.timeout(this.config.timeout || 180000),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        yield {
          content: '',
          done: true,
          finishReason: 'error',
        };
        return;
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        yield {
          content: '',
          done: true,
          finishReason: 'error',
        };
        return;
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          yield {
            content: '',
            done: true,
            finishReason: 'stop',
          };
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data: WenxinStreamChunk = JSON.parse(line);
            
            if (data.result) {
              yield {
                content: data.result,
                done: false,
              };
            }
            
            if (data.is_end) {
              let finishReason: GenerateResult['finishReason'] = 'stop';
              if (data.is_truncated) {
                finishReason = 'length';
              }
              
              yield {
                content: '',
                done: true,
                finishReason,
                usage: data.usage ? {
                  promptTokens: data.usage.prompt_tokens,
                  completionTokens: data.usage.completion_tokens,
                  totalTokens: data.usage.total_tokens,
                } : undefined,
              };
              return;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      yield {
        content: '',
        done: true,
        finishReason: 'error',
      };
    }
  }
  
  /**
   * 生成Embedding向量
   */
  async embed(
    text: string,
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    const model = options?.model || this.config.defaultEmbeddingModel || 'embedding-v1';
    
    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(
        `${this.config.baseUrl}/embeddings/embedding-v1?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: [text],
          }),
          signal: AbortSignal.timeout(this.config.timeout || 60000),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wenxin embedding error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;
      
      if (!embedding) {
        throw new Error('No embedding returned');
      }
      
      return {
        embedding,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Wenxin embedding failed: ${errorMessage}`);
    }
  }
  
  /**
   * 批量生成Embedding向量
   */
  async embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    // 文心一言支持批量嵌入，但限制最多16个文本
    const batchSize = 16;
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const token = await this.getAccessToken();
        
        const response = await fetch(
          `${this.config.baseUrl}/embeddings/embedding-v1?access_token=${token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: batch,
            }),
            signal: AbortSignal.timeout(this.config.timeout || 120000),
          }
        );
        
        if (!response.ok) {
          // 回退到逐个处理
          for (const text of batch) {
            results.push(await this.embed(text, options));
          }
          continue;
        }
        
        const data = await response.json();
        
        for (const item of data.data || []) {
          results.push({
            embedding: item.embedding,
            usage: {
              promptTokens: data.usage?.prompt_tokens || 0,
              totalTokens: data.usage?.total_tokens || 0,
            },
          });
        }
      } catch {
        // 回退到逐个处理
        for (const text of batch) {
          results.push(await this.embed(text, options));
        }
      }
    }
    
    return results;
  }
}

/**
 * 创建文心一言适配器实例
 */
export function createWenxinAdapter(config: WenxinProviderConfig): WenxinAdapter {
  return new WenxinAdapter(config);
}

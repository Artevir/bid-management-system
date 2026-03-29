/**
 * OpenAI兼容适配器
 * 支持所有兼容OpenAI API的服务：
 * - vLLM
 * - LocalAI
 * - LM Studio
 * - Text Generation WebUI (oobabooga)
 * - DeepSeek API
 * - 其他OpenAI兼容服务
 */

import {
  LLMAdapter,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResult,
  OpenAICompatibleProviderConfig,
} from '../types';

/**
 * OpenAI兼容适配器默认配置
 */
const DEFAULT_CONFIG: Partial<OpenAICompatibleProviderConfig> = {
  baseUrl: 'http://localhost:8000/v1', // vLLM默认地址
  defaultModel: 'default',
  defaultEmbeddingModel: 'default',
  timeout: 120000,
  maxRetries: 3,
};

/**
 * OpenAI API响应类型
 */
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

/**
 * OpenAI兼容适配器实现
 */
export class OpenAICompatibleAdapter implements LLMAdapter {
  readonly name = 'OpenAI Compatible';
  readonly provider = 'openai-compatible' as const;
  
  private config: OpenAICompatibleProviderConfig;
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(config: OpenAICompatibleProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = (this.config.baseUrl || DEFAULT_CONFIG.baseUrl!).replace(/\/$/, '');
    
    // 构建请求头
    this.headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.config.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    if (this.config.organization) {
      this.headers['OpenAI-Organization'] = this.config.organization;
    }
  }
  
  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });
      
      if (!response.ok) {
        return [this.config.defaultModel || 'default'];
      }
      
      const data: OpenAIModelResponse = await response.json();
      return data.data?.map(m => m.id) || [this.config.defaultModel || 'default'];
    } catch {
      return [this.config.defaultModel || 'default'];
    }
  }
  
  /**
   * 生成文本（非流式）
   */
  async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = options?.model || this.config.defaultModel || 'default';
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            name: m.name,
          })),
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stop,
          frequency_penalty: options?.frequencyPenalty,
          presence_penalty: options?.presencePenalty,
          stream: false,
          ...options?.extra,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: '',
          finishReason: 'error',
          extra: { error: `API error: ${response.status} ${errorText}` },
        };
      }
      
      const data: OpenAIChatResponse = await response.json();
      const choice = data.choices?.[0];
      
      // 映射finish_reason
      let finishReason: GenerateResult['finishReason'] = 'stop';
      if (choice?.finish_reason === 'length') {
        finishReason = 'length';
      } else if (choice?.finish_reason === 'content_filter') {
        finishReason = 'content_filter';
      } else if (choice?.finish_reason === 'error') {
        finishReason = 'error';
      }
      
      return {
        content: choice?.message?.content || '',
        model: data.model,
        finishReason,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
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
    const model = options?.model || this.config.defaultModel || 'default';
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            name: m.name,
          })),
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stop,
          stream: true,
          stream_options: { include_usage: true },
          ...options?.extra,
        }),
        signal: options?.signal || AbortSignal.timeout(this.config.timeout || 120000),
      });
      
      if (!response.ok) {
        const _errorText = await response.text();
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
          if (!line.trim() || !line.startsWith('data:')) continue;
          
          const dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') {
            yield {
              content: '',
              done: true,
              finishReason: 'stop',
            };
            return;
          }
          
          try {
            const data: OpenAIStreamChunk = JSON.parse(dataStr);
            const choice = data.choices?.[0];
            
            if (choice?.delta?.content) {
              yield {
                content: choice.delta.content,
                done: false,
              };
            }
            
            if (choice?.finish_reason) {
              let finishReason: GenerateResult['finishReason'] = 'stop';
              if (choice.finish_reason === 'length') {
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
      const _errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    const model = options?.model || this.config.defaultEmbeddingModel || 'default';
    
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model,
          input: text,
          dimensions: options?.dimensions,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} ${errorText}`);
      }
      
      const data: OpenAIEmbeddingResponse = await response.json();
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
      throw new Error(`Embedding failed: ${errorMessage}`);
    }
  }
  
  /**
   * 批量生成Embedding向量
   */
  async embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    const model = options?.model || this.config.defaultEmbeddingModel || 'default';
    
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model,
          input: texts,
          dimensions: options?.dimensions,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch embedding API error: ${response.status} ${errorText}`);
      }
      
      const data: OpenAIEmbeddingResponse = await response.json();
      
      return data.data
        .sort((a, b) => a.index - b.index)
        .map(item => ({
          embedding: item.embedding,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        }));
    } catch (_error) {
      // 如果批量接口不支持，回退到逐个处理
      const results: EmbeddingResult[] = [];
      for (const text of texts) {
        const result = await this.embed(text, options);
        results.push(result);
      }
      return results;
    }
  }
}

/**
 * 创建OpenAI兼容适配器实例
 */
export function createOpenAICompatibleAdapter(
  config: OpenAICompatibleProviderConfig
): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter(config);
}

/**
 * DeepSeek适配器
 * DeepSeek API使用OpenAI兼容格式
 * 文档: https://platform.deepseek.com/api-docs/
 */

import {
  LLMAdapter,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResult,
  DeepSeekProviderConfig,
} from '../types';

/**
 * DeepSeek适配器默认配置
 */
const DEFAULT_CONFIG: Partial<DeepSeekProviderConfig> = {
  baseUrl: 'https://api.deepseek.com/v1',
  defaultModel: 'deepseek-chat',
  defaultEmbeddingModel: 'deepseek-embed',
  timeout: 120000,
  maxRetries: 3,
};

/**
 * DeepSeek可用模型
 */
const DEEPSEEK_MODELS = [
  'deepseek-chat',           // 通用对话模型
  'deepseek-coder',          // 代码专用模型
  'deepseek-reasoner',       // 推理模型 (R1)
  'deepseek-embed',          // Embedding模型
];

/**
 * DeepSeek API响应类型
 */
interface DeepSeekChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string; // R1模型的推理过程
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
}

interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      reasoning_content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DeepSeekEmbeddingResponse {
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

/**
 * DeepSeek适配器实现
 */
export class DeepSeekAdapter implements LLMAdapter {
  readonly name = 'DeepSeek';
  readonly provider = 'deepseek' as const;
  
  private config: DeepSeekProviderConfig;
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(config: DeepSeekProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = (this.config.baseUrl || DEFAULT_CONFIG.baseUrl!).replace(/\/$/, '');
    
    this.headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.config.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
  }
  
  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // DeepSeek没有models列表API，尝试一个简单请求
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      // 如果models端点不可用，尝试简单的chat请求
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(10000),
        });
        return response.ok;
      } catch {
        return false;
      }
    }
  }
  
  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    return [...DEEPSEEK_MODELS];
  }
  
  /**
   * 生成文本（非流式）
   */
  async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = options?.model || this.config.defaultModel || 'deepseek-chat';
    
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
        }),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: '',
          finishReason: 'error',
          extra: { error: `DeepSeek API error: ${response.status} ${errorText}` },
        };
      }
      
      const data: DeepSeekChatResponse = await response.json();
      const choice = data.choices?.[0];
      
      // 合并推理内容和最终内容（如果有）
      let content = choice?.message?.content || '';
      const reasoningContent = choice?.message?.reasoning_content;
      
      // 映射finish_reason
      let finishReason: GenerateResult['finishReason'] = 'stop';
      if (choice?.finish_reason === 'length') {
        finishReason = 'length';
      } else if (choice?.finish_reason === 'content_filter') {
        finishReason = 'content_filter';
      }
      
      return {
        content,
        model: data.model,
        finishReason,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        extra: {
          reasoningContent,
          cacheHitTokens: data.usage?.prompt_cache_hit_tokens,
          cacheMissTokens: data.usage?.prompt_cache_miss_tokens,
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
    const model = options?.model || this.config.defaultModel || 'deepseek-chat';
    
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
        }),
        signal: AbortSignal.timeout(this.config.timeout || 180000),
      });
      
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
            const data: DeepSeekStreamChunk = JSON.parse(dataStr);
            const choice = data.choices?.[0];
            
            // 处理推理内容（R1模型）
            if (choice?.delta?.reasoning_content) {
              // 可以选择是否输出推理过程
              // 这里我们先输出，用户可以自行过滤
              yield {
                content: `[推理] ${choice.delta.reasoning_content}`,
                done: false,
              };
            }
            
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    const model = options?.model || this.config.defaultEmbeddingModel || 'deepseek-embed';
    
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model,
          input: text,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek embedding error: ${response.status} ${errorText}`);
      }
      
      const data: DeepSeekEmbeddingResponse = await response.json();
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
      throw new Error(`DeepSeek embedding failed: ${errorMessage}`);
    }
  }
  
  /**
   * 批量生成Embedding向量
   */
  async embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    const model = options?.model || this.config.defaultEmbeddingModel || 'deepseek-embed';
    
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model,
          input: texts,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch embedding error: ${response.status} ${errorText}`);
      }
      
      const data: DeepSeekEmbeddingResponse = await response.json();
      
      return data.data
        .sort((a, b) => a.index - b.index)
        .map(item => ({
          embedding: item.embedding,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        }));
    } catch (error) {
      // 回退到逐个处理
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
 * 创建DeepSeek适配器实例
 */
export function createDeepSeekAdapter(config: DeepSeekProviderConfig): DeepSeekAdapter {
  return new DeepSeekAdapter(config);
}

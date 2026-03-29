/**
 * 千问(Qwen/通义千问)适配器
 * 支持DashScope API和OpenAI兼容模式
 * 文档: https://help.aliyun.com/zh/dashscope/
 */

import {
  LLMAdapter,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResult,
  QwenProviderConfig,
} from '../types';

/**
 * 千问适配器默认配置
 */
const DEFAULT_CONFIG: Partial<QwenProviderConfig> = {
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  useOpenAICompatible: true,
  defaultModel: 'qwen-turbo',
  defaultEmbeddingModel: 'text-embedding-v3',
  timeout: 120000,
  maxRetries: 3,
};

/**
 * 千问可用模型
 */
const QWEN_MODELS = {
  chat: [
    'qwen-turbo',           // 快速响应
    'qwen-plus',            // 均衡模型
    'qwen-max',             // 最强能力
    'qwen-max-longcontext', // 长上下文
    'qwen-long',            // 超长上下文
    'qwen-coder-plus',      // 代码模型
    'qwen-coder-turbo',     // 快速代码模型
  ],
  embedding: [
    'text-embedding-v1',
    'text-embedding-v2',
    'text-embedding-v3',
  ],
};

/**
 * API响应类型
 */
interface QwenChatResponse {
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

interface QwenStreamChunk {
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

interface QwenEmbeddingResponse {
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
 * 千问适配器实现
 */
export class QwenAdapter implements LLMAdapter {
  readonly name = 'Qwen (通义千问)';
  readonly provider = 'qwen' as const;
  
  private config: QwenProviderConfig;
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(config: QwenProviderConfig) {
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
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      // 尝试简单的chat请求
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            model: 'qwen-turbo',
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
    return [...QWEN_MODELS.chat, ...QWEN_MODELS.embedding];
  }
  
  /**
   * 生成文本（非流式）
   */
  async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = options?.model || this.config.defaultModel || 'qwen-turbo';
    
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
          extra: { error: `Qwen API error: ${response.status} ${errorText}` },
        };
      }
      
      const data: QwenChatResponse = await response.json();
      const choice = data.choices?.[0];
      
      // 映射finish_reason
      let finishReason: GenerateResult['finishReason'] = 'stop';
      if (choice?.finish_reason === 'length') {
        finishReason = 'length';
      } else if (choice?.finish_reason === 'content_filter') {
        finishReason = 'content_filter';
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
    const model = options?.model || this.config.defaultModel || 'qwen-turbo';
    
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
        }),
        signal: AbortSignal.timeout(this.config.timeout || 180000),
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
            const data: QwenStreamChunk = JSON.parse(dataStr);
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
    const model = options?.model || this.config.defaultEmbeddingModel || 'text-embedding-v3';
    
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
        throw new Error(`Qwen embedding error: ${response.status} ${errorText}`);
      }
      
      const data: QwenEmbeddingResponse = await response.json();
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
      throw new Error(`Qwen embedding failed: ${errorMessage}`);
    }
  }
  
  /**
   * 批量生成Embedding向量
   */
  async embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    const model = options?.model || this.config.defaultEmbeddingModel || 'text-embedding-v3';
    
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
        throw new Error(`Batch embedding error: ${response.status} ${errorText}`);
      }
      
      const data: QwenEmbeddingResponse = await response.json();
      
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
 * 创建千问适配器实例
 */
export function createQwenAdapter(config: QwenProviderConfig): QwenAdapter {
  return new QwenAdapter(config);
}

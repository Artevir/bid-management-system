/**
 * Ollama本地部署适配器
 * 支持本地运行的Ollama服务
 * 文档: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import {
  LLMAdapter,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResult,
  OllamaProviderConfig,
} from '../types';

/**
 * Ollama适配器默认配置
 */
const DEFAULT_CONFIG: Partial<OllamaProviderConfig> = {
  baseUrl: 'http://localhost:11434',
  defaultModel: 'llama3',
  defaultEmbeddingModel: 'nomic-embed-text',
  timeout: 120000, // 本地推理可能较慢
  maxRetries: 2,
};

/**
 * Ollama API响应类型
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  response?: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

/**
 * Ollama本地部署适配器实现
 */
export class OllamaAdapter implements LLMAdapter {
  readonly name = 'Ollama Local';
  readonly provider = 'ollama' as const;
  
  private config: OllamaProviderConfig;
  private baseUrl: string;
  
  constructor(config: OllamaProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = this.config.baseUrl || DEFAULT_CONFIG.baseUrl!;
  }
  
  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
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
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      });
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      return (data.models || []).map((m: OllamaModelInfo) => m.name);
    } catch {
      return [];
    }
  }
  
  /**
   * 生成文本（非流式）
   */
  async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = options?.model || this.config.defaultModel || 'llama3';
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
          options: {
            temperature: options?.temperature,
            num_predict: options?.maxTokens,
            top_p: options?.topP,
            stop: options?.stop,
            frequency_penalty: options?.frequencyPenalty,
            presence_penalty: options?.presencePenalty,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: '',
          finishReason: 'error',
          extra: { error: `Ollama API error: ${response.status} ${errorText}` },
        };
      }
      
      const data: OllamaGenerateResponse = await response.json();
      
      return {
        content: data.message?.content || data.response || '',
        model: data.model,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        extra: {
          totalDuration: data.total_duration,
          loadDuration: data.load_duration,
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
    const model = options?.model || this.config.defaultModel || 'llama3';
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
          options: {
            temperature: options?.temperature,
            num_predict: options?.maxTokens,
            top_p: options?.topP,
            stop: options?.stop,
          },
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
      let totalTokens = 0;
      let promptTokens = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          yield {
            content: '',
            done: true,
            finishReason: 'stop',
            usage: {
              promptTokens,
              completionTokens: totalTokens,
              totalTokens: promptTokens + totalTokens,
            },
          };
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data: OllamaGenerateResponse = JSON.parse(line);
            
            if (data.message?.content) {
              totalTokens += 1; // 近似计数
              yield {
                content: data.message.content,
                done: false,
              };
            }
            
            if (data.done) {
              promptTokens = data.prompt_eval_count || 0;
              yield {
                content: '',
                done: true,
                finishReason: 'stop',
                usage: {
                  promptTokens,
                  completionTokens: data.eval_count || totalTokens,
                  totalTokens: promptTokens + (data.eval_count || totalTokens),
                },
              };
              return;
            }
          } catch {
            // 忽略解析错误，继续处理下一行
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
    const model = options?.model || this.config.defaultEmbeddingModel || 'nomic-embed-text';
    
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama embedding error: ${response.status} ${errorText}`);
      }
      
      const data: OllamaEmbeddingResponse = await response.json();
      
      return {
        embedding: data.embedding,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Ollama embedding failed: ${errorMessage}`);
    }
  }
  
  /**
   * 批量生成Embedding向量
   */
  async embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      const result = await this.embed(text, options);
      results.push(result);
    }
    
    return results;
  }
}

/**
 * 创建Ollama适配器实例
 */
export function createOllamaAdapter(config: OllamaProviderConfig): OllamaAdapter {
  return new OllamaAdapter(config);
}

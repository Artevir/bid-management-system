/**
 * Coze云端API适配器
 * 使用coze-coding-dev-sdk实现
 */

import { LLMClient, EmbeddingClient, Config } from 'coze-coding-dev-sdk';
import {
  LLMAdapter,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResult,
  CozeProviderConfig,
} from '../types';

/**
 * Coze适配器默认配置
 */
const DEFAULT_CONFIG: Partial<CozeProviderConfig> = {
  defaultModel: 'doubao-seed-1-8-251228',
  defaultEmbeddingModel: 'doubao-embedding',
  timeout: 60000,
  maxRetries: 3,
};

/**
 * Coze云端API适配器实现
 */
export class CozeAdapter implements LLMAdapter {
  readonly name = 'Coze Cloud';
  readonly provider = 'coze' as const;
  
  private config: CozeProviderConfig;
  private llmClient: LLMClient;
  private embeddingClient: EmbeddingClient;
  
  constructor(config: CozeProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const sdkConfig = new Config();
    this.llmClient = new LLMClient(sdkConfig, this.config.customHeaders as any);
    this.embeddingClient = new EmbeddingClient({ customHeaders: this.config.customHeaders } as any);
  }
  
  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 尝试一个简单的调用来检查服务状态
      const result = await this.generate(
        [{ role: 'user', content: 'test' }],
        { maxTokens: 1 }
      );
      return result.finishReason !== 'error';
    } catch {
      return false;
    }
  }
  
  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    // Coze SDK 暂不支持动态获取模型列表，返回已知模型
    return [
      'doubao-seed-1-8-251228',
      'doubao-pro-4k',
      'doubao-lite-4k',
      'doubao-embedding',
    ];
  }
  
  /**
   * 生成文本（非流式）
   */
  async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = options?.model || this.config.defaultModel || 'doubao-seed-1-8-251228';
    
    try {
      const response = await this.llmClient.invoke(
        messages.map(m => ({ role: m.role, content: m.content })),
        {
          model,
          temperature: options?.temperature,
          // @ts-ignore - SDK类型定义可能不完整
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stop,
        }
      );
      
      // 安全地获取usage信息
      const responseUsage = (response as any).usage;
      
      return {
        content: response.content,
        model,
        finishReason: 'stop',
        usage: responseUsage ? {
          promptTokens: responseUsage.prompt_tokens || 0,
          completionTokens: responseUsage.completion_tokens || 0,
          totalTokens: responseUsage.total_tokens || 0,
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
    const model = options?.model || this.config.defaultModel || 'doubao-seed-1-8-251228';
    
    try {
      const stream = this.llmClient.stream(
        messages.map(m => ({ role: m.role, content: m.content })),
        {
          model,
          temperature: options?.temperature,
          // @ts-ignore
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stop,
        }
      );
      
      let totalContent = '';
      
      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString();
          totalContent += text;
          yield {
            content: text,
            done: false,
          };
        }
      }
      
      // 发送完成信号
      yield {
        content: '',
        done: true,
        finishReason: 'stop',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield {
        content: '',
        done: true,
        finishReason: 'error',
        extra: { error: errorMessage } as any,
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
    try {
      const embedding = await this.embeddingClient.embedText(text, {
        dimensions: options?.dimensions,
      });
      
      return {
        embedding,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Coze embedding failed: ${errorMessage}`);
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
 * 创建Coze适配器实例
 */
export function createCozeAdapter(config: CozeProviderConfig): CozeAdapter {
  return new CozeAdapter(config);
}

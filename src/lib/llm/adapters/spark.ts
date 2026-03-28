/**
 * 讯飞星火适配器
 * 使用讯飞开放平台API (WebSocket协议)
 * 文档: https://www.xfyun.cn/doc/spark/Web.html
 */

import {
  LLMAdapter,
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
  EmbeddingOptions,
  EmbeddingResult,
  SparkProviderConfig,
} from '../types';
import crypto from 'crypto';

/**
 * 星火默认配置
 */
const DEFAULT_CONFIG: Partial<SparkProviderConfig> = {
  baseUrl: 'wss://spark-api.xf-yun.com',
  defaultModel: 'spark-4.0-ultra',
  defaultEmbeddingModel: 'embedding-v1',
  timeout: 120000,
  maxRetries: 3,
};

/**
 * 星火可用模型
 */
const SPARK_MODELS = {
  chat: [
    'spark-4.0-ultra',    // Spark 4.0 Ultra
    'spark-4.0',          // Spark 4.0
    'spark-3.5-max',      // Spark 3.5 Max
    'spark-3.5',          // Spark 3.5
    'spark-3.0',          // Spark 3.0
    'spark-2.0',          // Spark 2.0
    'spark-1.5',          // Spark 1.5
  ],
  embedding: [
    'embedding-v1',
  ],
};

/**
 * 模型域名映射
 */
const MODEL_DOMAINS: Record<string, string> = {
  'spark-4.0-ultra': '4.0Ultra',
  'spark-4.0': 'generalv4',
  'spark-3.5-max': 'generalv3.5',
  'spark-3.5': 'generalv3.5',
  'spark-3.0': 'generalv3',
  'spark-2.0': 'generalv2',
  'spark-1.5': 'general',
};

/**
 * WebSocket URL版本映射
 */
const MODEL_VERSIONS: Record<string, string> = {
  'spark-4.0-ultra': 'v4.0',
  'spark-4.0': 'v4.0',
  'spark-3.5-max': 'v3.5',
  'spark-3.5': 'v3.5',
  'spark-3.0': 'v3.1',
  'spark-2.0': 'v2.1',
  'spark-1.5': 'v1.1',
};

/**
 * API响应类型
 */
interface SparkResponse {
  header: {
    code: number;
    message: string;
    sid: string;
    status: number;
  };
  payload: {
    choices: {
      status: number;
      seq: number;
      text: Array<{
        content: string;
        role: string;
        index: number;
      }>;
    };
    usage?: {
      text: {
        question_tokens: number;
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  };
}

/**
 * 讯飞星火适配器实现
 */
export class SparkAdapter implements LLMAdapter {
  readonly name = '讯飞星火 (Spark)';
  readonly provider = 'spark' as const;
  
  private config: SparkProviderConfig;
  
  constructor(config: SparkProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 生成鉴权URL
   */
  private generateAuthUrl(model: string): string {
    const version = MODEL_VERSIONS[model] || 'v3.5';
    const host = `spark-api.xf-yun.com`;
    const path = `/${version}/chat`;
    
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureOrigin = `host: ${host}\ndate: ${timestamp}\nGET ${path} HTTP/1.1`;
    
    const signature = crypto
      .createHmac('sha256', this.config.apiSecret!)
      .update(signatureOrigin)
      .digest('base64');
    
    const authorizationOrigin = `api_key="${this.config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    const url = new URL(`wss://${host}${path}`);
    url.searchParams.set('authorization', authorization);
    url.searchParams.set('date', timestamp);
    url.searchParams.set('host', host);
    
    return url.toString();
  }
  
  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 简单检查配置是否完整
      return !!(this.config.apiKey && this.config.apiSecret && this.config.appId);
    } catch {
      return false;
    }
  }
  
  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    return [...SPARK_MODELS.chat, ...SPARK_MODELS.embedding];
  }
  
  /**
   * 生成文本（非流式）
   * 注意：星火API使用WebSocket，这里通过收集流式数据实现非流式效果
   */
  async generate(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    const model = options?.model || this.config.defaultModel || 'spark-3.5';
    
    try {
      let fullContent = '';
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
      
      for await (const chunk of this.generateStream(messages, options)) {
        if (chunk.content) {
          fullContent += chunk.content;
        }
        if (chunk.usage) {
          usage = chunk.usage;
        }
        if (chunk.done) {
          return {
            content: fullContent,
            model,
            finishReason: chunk.finishReason || 'stop',
            usage,
          };
        }
      }
      
      return {
        content: fullContent,
        model,
        finishReason: 'stop',
        usage,
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
   * 使用WebSocket协议
   */
  async *generateStream(
    messages: ChatMessage[],
    options?: GenerateOptions
  ): AsyncIterable<StreamChunk> {
    const model = options?.model || this.config.defaultModel || 'spark-3.5';
    const domain = MODEL_DOMAINS[model] || 'generalv3.5';
    
    // 在服务器环境中，WebSocket可能不可用，需要动态导入
    const WebSocket = (await import('ws')).default;
    
    const url = this.generateAuthUrl(model);
    
    // 构建请求体
    const requestBody = {
      header: {
        app_id: this.config.appId,
        uid: 'user_' + Date.now(),
      },
      parameter: {
        chat: {
          domain: domain,
          temperature: options?.temperature || 0.5,
          max_tokens: options?.maxTokens || 4096,
          top_k: 4,
        },
      },
      payload: {
        message: {
          text: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
      },
    };
    
    const ws = new WebSocket(url);
    let resolveConnect: () => void;
    let rejectConnect: (err: Error) => void;
    const connectPromise = new Promise<void>((resolve, reject) => {
      resolveConnect = resolve;
      rejectConnect = reject;
    });
    
    const messageQueue: SparkResponse[] = [];
    let done = false;
    let error: Error | null = null;
    
    ws.on('open', () => {
      ws.send(JSON.stringify(requestBody));
      resolveConnect();
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const response: SparkResponse = JSON.parse(data.toString());
        messageQueue.push(response);
        
        // 检查是否完成
        if (response.header.status === 2) {
          done = true;
          ws.close();
        }
      } catch (e) {
        error = e instanceof Error ? e : new Error('Parse error');
      }
    });
    
    ws.on('error', (err: Error) => {
      error = err;
      done = true;
    });
    
    ws.on('close', () => {
      done = true;
    });
    
    // 等待连接建立
    await connectPromise;
    
    // 处理消息队列
    while (!done || messageQueue.length > 0) {
      if (error) {
        yield {
          content: '',
          done: true,
          finishReason: 'error',
        };
        return;
      }
      
      if (messageQueue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }
      
      const response = messageQueue.shift()!;
      
      if (response.header.code !== 0) {
        yield {
          content: '',
          done: true,
          finishReason: 'error',
        };
        return;
      }
      
      const text = response.payload.choices.text;
      
      for (const item of text) {
        if (item.content) {
          yield {
            content: item.content,
            done: false,
          };
        }
      }
      
      // 检查是否最后一帧
      if (response.header.status === 2) {
        const usage = response.payload.usage?.text;
        yield {
          content: '',
          done: true,
          finishReason: 'stop',
          usage: usage ? {
            promptTokens: usage.prompt_tokens || usage.question_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          } : undefined,
        };
      }
    }
  }
  
  /**
   * 生成Embedding向量
   * 星火通过HTTP API提供Embedding服务
   */
  async embed(
    text: string,
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    // 星火Embedding API需要单独实现
    // 暂时使用HTTP API
    try {
      const response = await fetch('https://api.xf-yun.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model || this.config.defaultEmbeddingModel || 'embedding-v1',
          input: text,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });
      
      if (!response.ok) {
        throw new Error(`Spark embedding error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        embedding: data.data?.[0]?.embedding || [],
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Spark embedding failed: ${errorMessage}`);
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
    
    // 星火暂不支持批量嵌入，逐个处理
    for (const text of texts) {
      const result = await this.embed(text, options);
      results.push(result);
    }
    
    return results;
  }
}

/**
 * 创建星火适配器实例
 */
export function createSparkAdapter(config: SparkProviderConfig): SparkAdapter {
  return new SparkAdapter(config);
}

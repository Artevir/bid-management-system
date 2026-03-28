/**
 * 向量嵌入服务
 * 用于将文本转换为向量表示，支持语义搜索和相似度计算
 * 
 * 已迁移至统一LLM适配层，支持多种部署方式
 */

import { getLLM, getLLMByProvider, LLMProvider, createCozeAdapterWithHeaders } from '@/lib/llm';

// 向量嵌入配置
export interface EmbeddingConfig {
  dimensions?: number; // 向量维度，默认1024
  customHeaders?: Record<string, string>;
  provider?: LLMProvider; // 指定提供商
}

// 相似度搜索结果
export interface SimilarityResult {
  id: number;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * 生成文本的向量嵌入
 * @param text 要嵌入的文本
 * @param config 嵌入配置
 * @returns 向量数组
 */
export async function embedText(
  text: string,
  config?: EmbeddingConfig
): Promise<number[]> {
  try {
    // 如果有自定义头，使用Coze适配器（兼容现有行为）
    let llm;
    if (config?.customHeaders) {
      llm = createCozeAdapterWithHeaders(config.customHeaders);
    } else if (config?.provider) {
      llm = getLLMByProvider(config.provider);
    } else {
      llm = getLLM();
    }
    
    const result = await llm.embed(text, {
      dimensions: config?.dimensions,
    });
    
    return result.embedding;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Embedding API error:', errorMessage);
    throw new Error(`向量嵌入失败: ${errorMessage}`);
  }
}

/**
 * 批量生成文本的向量嵌入
 * @param texts 文本数组
 * @param config 嵌入配置
 * @returns 向量数组
 */
export async function embedTexts(
  texts: string[],
  config?: EmbeddingConfig
): Promise<number[][]> {
  try {
    // 如果有自定义头，使用Coze适配器（兼容现有行为）
    let llm;
    if (config?.customHeaders) {
      llm = createCozeAdapterWithHeaders(config.customHeaders);
    } else if (config?.provider) {
      llm = getLLMByProvider(config.provider);
    } else {
      llm = getLLM();
    }
    
    const results = await llm.embedBatch(texts, {
      dimensions: config?.dimensions,
    });
    
    return results.map(r => r.embedding);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Batch embedding API error:', errorMessage);
    throw new Error(`批量向量嵌入失败: ${errorMessage}`);
  }
}

/**
 * 计算两个向量的余弦相似度
 * @param a 向量A
 * @param b 向量B
 * @returns 相似度分数 (0-1)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 批量计算相似度
 * @param queryEmbedding 查询向量
 * @param embeddings 文档向量数组
 * @returns 相似度分数数组
 */
export function batchSimilarity(
  queryEmbedding: number[],
  embeddings: number[][]
): number[] {
  return embeddings.map(emb => cosineSimilarity(queryEmbedding, emb));
}

/**
 * 语义搜索
 * @param query 查询文本
 * @param documents 文档列表（包含ID、内容和向量）
 * @param topK 返回前K个结果
 * @param config 嵌入配置
 * @returns 排序后的相似度结果
 */
export async function semanticSearch(
  query: string,
  documents: Array<{
    id: number;
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  }>,
  topK: number = 5,
  config?: EmbeddingConfig
): Promise<SimilarityResult[]> {
  // 如果文档没有向量，需要先生成
  const docsWithEmbedding = await Promise.all(
    documents.map(async (doc) => {
      if (doc.embedding) {
        return doc;
      }
      const embedding = await embedText(doc.content, config);
      return { ...doc, embedding };
    })
  );
  
  // 生成查询向量
  const queryEmbedding = await embedText(query, config);
  
  // 计算相似度
  const results = docsWithEmbedding.map((doc) => ({
    id: doc.id,
    content: doc.content,
    score: cosineSimilarity(queryEmbedding, doc.embedding!),
    metadata: doc.metadata,
  }));
  
  // 按相似度排序并返回前K个
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * 将向量数组转换为JSON字符串（用于存储）
 * @param embedding 向量数组
 * @returns JSON字符串
 */
export function embeddingToJson(embedding: number[]): string {
  return JSON.stringify(embedding);
}

/**
 * 从JSON字符串解析向量
 * @param json JSON字符串
 * @returns 向量数组
 */
export function jsonToEmbedding(json: string): number[] {
  return JSON.parse(json) as number[];
}

/**
 * 知识条目嵌入服务
 */
export class KnowledgeEmbeddingService {
  private config: EmbeddingConfig;
  
  constructor(config?: EmbeddingConfig) {
    this.config = config || {};
  }
  
  /**
   * 为知识条目生成向量嵌入
   * @param title 标题
   * @param content 内容
   * @returns 向量JSON字符串
   */
  async generateKnowledgeEmbedding(
    title: string,
    content: string
  ): Promise<string> {
    // 将标题和内容组合生成嵌入
    const combinedText = `${title}\n\n${content}`;
    const embedding = await embedText(combinedText, this.config);
    return embeddingToJson(embedding);
  }
  
  /**
   * 搜索相似知识条目
   * @param query 查询文本
   * @param knowledgeItems 知识条目列表
   * @param topK 返回前K个结果
   * @returns 相似度结果
   */
  async searchSimilarKnowledge(
    query: string,
    knowledgeItems: Array<{
      id: number;
      title: string;
      content: string;
      embeddingVector?: string | null;
    }>,
    topK: number = 5
  ): Promise<SimilarityResult[]> {
    // 解析向量并构建文档列表
    const documents = knowledgeItems.map((item) => ({
      id: item.id,
      content: `${item.title}\n\n${item.content}`,
      embedding: item.embeddingVector 
        ? jsonToEmbedding(item.embeddingVector) 
        : undefined,
    }));
    
    return semanticSearch(query, documents, topK, this.config);
  }
}

/**
 * 文档解析嵌入服务
 */
export class ParseEmbeddingService {
  private config: EmbeddingConfig;
  
  constructor(config?: EmbeddingConfig) {
    this.config = config || {};
  }
  
  /**
   * 为解析项生成向量嵌入
   * @param title 标题
   * @param content 内容
   * @returns 向量JSON字符串
   */
  async generateParseItemEmbedding(
    title: string,
    content: string
  ): Promise<string> {
    const combinedText = `${title}\n\n${content}`;
    const embedding = await embedText(combinedText, this.config);
    return embeddingToJson(embedding);
  }
  
  /**
   * 搜索相似解析项
   * @param query 查询文本
   * @param parseItems 解析项列表
   * @param topK 返回前K个结果
   * @returns 相似度结果
   */
  async searchSimilarParseItems(
    query: string,
    parseItems: Array<{
      id: number;
      title: string;
      content: string;
    }>,
    topK: number = 5
  ): Promise<SimilarityResult[]> {
    // 解析项通常没有预存向量，需要实时生成
    const documents = parseItems.map((item) => ({
      id: item.id,
      content: `${item.title}\n\n${item.content}`,
    }));
    
    return semanticSearch(query, documents, topK, this.config);
  }
}

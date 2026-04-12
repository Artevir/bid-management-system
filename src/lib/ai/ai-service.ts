/**
 * AI调用统一服务
 * 支持两种调用模式：
 * 1. AI角色模式：使用预设的AI角色模板进行调用
 * 2. 直接调用模式：现场写提示词直接调用LLM
 */

import { db } from '@/db';
import { aiAgents, aiAgentUsage } from '@/db/ai-agent-schema';
import { llmCallLogs } from '@/db/llm-schema';
import { eq, desc, sql } from 'drizzle-orm';
import {
  getConfigById,
  getDefaultConfig,
  streamChat,
  invokeChat,
  logCall,
  type LLMProvider,
} from '@/lib/llm/service';
import type { Message } from 'coze-coding-dev-sdk';

// ============================================
// 类型定义
// ============================================

export interface AICallOptions {
  // 调用模式
  mode: 'agent' | 'direct';

  // AI角色模式参数
  agentId?: number;

  // 直接调用模式参数
  systemPrompt?: string;
  userMessage?: string;

  // 通用参数
  configId?: number;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  thinking?: boolean;
  caching?: boolean;

  // 上下文信息
  context?: string;
  userId?: number;
}

export interface AICallResult {
  content: string;
  agentId?: number;
  agentName?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latency: number;
}

export interface StreamChunk {
  type: 'content' | 'usage' | 'done';
  content?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  agentId?: number;
  agentName?: string;
}

// ============================================
// AI角色服务
// ============================================

/**
 * 获取AI角色列表
 */
export async function getAgentList() {
  const agents = await db
    .select({
      id: aiAgents.id,
      name: aiAgents.name,
      roleType: aiAgents.roleType,
      description: aiAgents.description,
      systemPrompt: aiAgents.systemPrompt,
      modelConfig: aiAgents.modelConfig,
      isActive: aiAgents.isActive,
      useCount: aiAgents.useCount,
      createdAt: aiAgents.createdAt,
    })
    .from(aiAgents)
    .where(eq(aiAgents.isActive, true))
    .orderBy(desc(aiAgents.useCount));

  return agents;
}

/**
 * 获取AI角色详情
 */
export async function getAgentById(agentId: number) {
  const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, agentId)).limit(1);

  return agent || null;
}

/**
 * 增加AI角色使用次数
 */
export async function incrementAgentUsage(agentId: number) {
  await db
    .update(aiAgents)
    .set({
      useCount: sql`${aiAgents.useCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(aiAgents.id, agentId));
}

/**
 * 记录AI角色使用日志
 */
export async function logAgentUsage(data: {
  agentId: number;
  userId?: number;
  conversationHistory?: string;
  responseContent?: string;
  inputTokens?: number;
  outputTokens?: number;
  latency?: number;
  status: 'success' | 'error';
  errorMessage?: string;
  context?: string;
}) {
  await db.insert(aiAgentUsage).values({
    agentId: data.agentId,
    userId: data.userId,
    conversationHistory: data.conversationHistory || '',
    responseContent: data.responseContent || '',
    inputTokens: data.inputTokens || 0,
    outputTokens: data.outputTokens || 0,
    latency: data.latency || 0,
    status: data.status,
    errorMessage: data.errorMessage,
    context: data.context,
  });
}

// ============================================
// 统一AI调用服务
// ============================================

/**
 * 执行AI调用（非流式）
 */
export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const startTime = Date.now();

  try {
    // 1. 获取模型配置
    let modelConfig: any = null;
    if (options.configId) {
      modelConfig = await getConfigById(options.configId);
    } else {
      modelConfig = await getDefaultConfig();
    }

    const modelId = modelConfig?.modelId || 'doubao-seed-1-8-251228';
    const provider = getProviderFromModelId(modelId);

    // 2. 构建消息
    const messages: Message[] = [];
    let agentInfo: any = null;

    if (options.mode === 'agent' && options.agentId) {
      // AI角色模式
      agentInfo = await getAgentById(options.agentId);
      if (!agentInfo) {
        throw new Error('AI角色不存在');
      }

      // 添加系统提示词
      if (agentInfo.systemPrompt) {
        messages.push({ role: 'system', content: agentInfo.systemPrompt });
      }

      // 添加对话历史
      if (options.conversationHistory) {
        for (const msg of options.conversationHistory) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      // 添加当前用户消息
      if (options.userMessage) {
        messages.push({ role: 'user', content: options.userMessage });
      }
    } else {
      // 直接调用模式
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      if (options.conversationHistory) {
        for (const msg of options.conversationHistory) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      if (options.userMessage) {
        messages.push({ role: 'user', content: options.userMessage });
      }
    }

    if (messages.length === 0) {
      throw new Error('消息不能为空');
    }

    // 3. 执行调用
    const content = await invokeChat({
      configId: options.configId,
      messages,
      model: modelId,
      temperature: options.temperature ?? parseFloat(modelConfig?.defaultTemperature || '0.7'),
      thinking: (options.thinking ?? modelConfig?.defaultThinking) ? 'enabled' : 'disabled',
      caching: (options.caching ?? modelConfig?.defaultCaching) ? 'enabled' : 'disabled',
    });

    const latency = Date.now() - startTime;

    // 4. 记录日志
    await logCall({
      configId: modelConfig?.id,
      modelId,
      provider: provider as LLMProvider,
      inputTokens: messages.reduce((sum, m) => sum + (m.content?.length || 0), 0),
      outputTokens: content.length,
      latency,
      status: 'success',
      callContext: options.context ? { context: options.context } : undefined,
      createdBy: options.userId,
    });

    // 5. 更新AI角色使用次数
    if (options.agentId) {
      await incrementAgentUsage(options.agentId);
      await logAgentUsage({
        agentId: options.agentId,
        userId: options.userId,
        responseContent: content,
        latency,
        status: 'success',
        context: options.context,
      });
    }

    return {
      content,
      agentId: agentInfo?.id,
      agentName: agentInfo?.name,
      latency,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;

    // 记录错误日志
    if (options.agentId) {
      await logAgentUsage({
        agentId: options.agentId,
        userId: options.userId,
        latency,
        status: 'error',
        errorMessage: error.message,
        context: options.context,
      });
    }

    throw error;
  }
}

/**
 * 执行AI调用（流式）
 */
export async function* streamAI(
  options: AICallOptions,
  customHeaders?: Record<string, string>
): AsyncGenerator<StreamChunk> {
  const startTime = Date.now();
  let fullContent = '';
  let agentInfo: any = null;

  try {
    // 1. 获取模型配置
    let modelConfig: any = null;
    if (options.configId) {
      modelConfig = await getConfigById(options.configId);
    } else {
      modelConfig = await getDefaultConfig();
    }

    const modelId = modelConfig?.modelId || 'doubao-seed-1-8-251228';
    const provider = getProviderFromModelId(modelId);

    // 2. 构建消息
    const messages: Message[] = [];

    if (options.mode === 'agent' && options.agentId) {
      // AI角色模式
      agentInfo = await getAgentById(options.agentId);
      if (!agentInfo) {
        throw new Error('AI角色不存在');
      }

      // 添加系统提示词
      if (agentInfo.systemPrompt) {
        messages.push({ role: 'system', content: agentInfo.systemPrompt });
      }

      // 添加对话历史
      if (options.conversationHistory) {
        for (const msg of options.conversationHistory) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      // 添加当前用户消息
      if (options.userMessage) {
        messages.push({ role: 'user', content: options.userMessage });
      }
    } else {
      // 直接调用模式
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      if (options.conversationHistory) {
        for (const msg of options.conversationHistory) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      }

      if (options.userMessage) {
        messages.push({ role: 'user', content: options.userMessage });
      }
    }

    if (messages.length === 0) {
      throw new Error('消息不能为空');
    }

    // 3. 执行流式调用
    const stream = streamChat(
      {
        configId: options.configId,
        messages,
        model: modelId,
        temperature: options.temperature ?? parseFloat(modelConfig?.defaultTemperature || '0.7'),
        thinking: (options.thinking ?? modelConfig?.defaultThinking) ? 'enabled' : 'disabled',
        caching: (options.caching ?? modelConfig?.defaultCaching) ? 'enabled' : 'disabled',
      },
      customHeaders
    );

    for await (const chunk of stream) {
      fullContent += chunk;
      yield {
        type: 'content',
        content: chunk,
        agentId: agentInfo?.id,
        agentName: agentInfo?.name,
      };
    }

    const latency = Date.now() - startTime;

    // 4. 记录日志
    await logCall({
      configId: modelConfig?.id,
      modelId,
      provider: provider as LLMProvider,
      inputTokens: messages.reduce((sum, m) => sum + (m.content?.length || 0), 0),
      outputTokens: fullContent.length,
      latency,
      status: 'success',
      callContext: options.context ? { context: options.context } : undefined,
      createdBy: options.userId,
    });

    // 5. 更新AI角色使用次数
    if (options.agentId) {
      await incrementAgentUsage(options.agentId);
      await logAgentUsage({
        agentId: options.agentId,
        userId: options.userId,
        responseContent: fullContent,
        latency,
        status: 'success',
        context: options.context,
      });
    }

    // 6. 发送完成信号
    yield {
      type: 'done',
      finishReason: 'stop',
      agentId: agentInfo?.id,
      agentName: agentInfo?.name,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;

    // 记录错误日志
    if (options.agentId) {
      await logAgentUsage({
        agentId: options.agentId,
        userId: options.userId,
        responseContent: fullContent,
        latency,
        status: 'error',
        errorMessage: error.message,
        context: options.context,
      });
    }

    throw error;
  }
}

/**
 * 根据模型ID获取提供商
 */
function getProviderFromModelId(modelId: string): string {
  // DeepSeek
  if (modelId.includes('deepseek')) return 'deepseek';
  // Kimi
  if (modelId.includes('kimi')) return 'kimi';
  // GLM
  if (modelId.includes('glm')) return 'glm';
  // 千问
  if (modelId.includes('qwen')) return 'qwen';
  // OpenAI (GPT系列、O系列、Embedding、Moderation、Image等)
  if (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('o1-') ||
    modelId.startsWith('text-embedding') ||
    modelId.startsWith('omni-') ||
    modelId.includes('openai')
  ) {
    return 'openai';
  }
  // 默认豆包
  return 'doubao';
}

// ============================================
// 用量统计服务
// ============================================

/**
 * 获取用量统计概览
 */
export async function getUsageOverview(params?: {
  startDate?: Date;
  endDate?: Date;
  userId?: number;
}) {
  // 构建日期条件
  const dateConditions = [];
  if (params?.startDate) {
    dateConditions.push(sql`${llmCallLogs.createdAt} >= ${params.startDate}`);
  }
  if (params?.endDate) {
    dateConditions.push(sql`${llmCallLogs.createdAt} <= ${params.endDate}`);
  }

  // 获取总调用量
  const [totalStats] = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      totalInputTokens: sql<number>`sum(${llmCallLogs.inputTokens})`,
      totalOutputTokens: sql<number>`sum(${llmCallLogs.outputTokens})`,
      avgLatency: sql<number>`avg(${llmCallLogs.latency})`,
      successRate: sql<number>`avg(case when ${llmCallLogs.status} = 'success' then 1 else 0 end) * 100`,
    })
    .from(llmCallLogs)
    .where(dateConditions.length > 0 ? sql.join(dateConditions, sql` AND `) : undefined);

  return {
    totalCalls: Number(totalStats?.totalCalls || 0),
    totalInputTokens: Number(totalStats?.totalInputTokens || 0),
    totalOutputTokens: Number(totalStats?.totalOutputTokens || 0),
    avgLatency: Number(totalStats?.avgLatency || 0),
    successRate: Number(totalStats?.successRate || 0),
  };
}

/**
 * 获取每日用量统计
 */
export async function getDailyUsage(params?: { startDate?: Date; endDate?: Date; days?: number }) {
  const days = params?.days || 7;
  const startDate = params?.startDate || new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const dailyStats = await db
    .select({
      date: sql<string>`date(${llmCallLogs.createdAt})`,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`sum(${llmCallLogs.inputTokens})`,
      outputTokens: sql<number>`sum(${llmCallLogs.outputTokens})`,
      avgLatency: sql<number>`avg(${llmCallLogs.latency})`,
    })
    .from(llmCallLogs)
    .where(sql`${llmCallLogs.createdAt} >= ${startDate}`)
    .groupBy(sql`date(${llmCallLogs.createdAt})`)
    .orderBy(sql`date(${llmCallLogs.createdAt})`);

  return dailyStats.map((stat) => ({
    date: stat.date,
    calls: Number(stat.calls),
    inputTokens: Number(stat.inputTokens || 0),
    outputTokens: Number(stat.outputTokens || 0),
    avgLatency: Number(stat.avgLatency || 0),
  }));
}

/**
 * 获取模型用量排行
 */
export async function getModelUsageRanking(params?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const limit = params?.limit || 10;
  const dateConditions = [];
  if (params?.startDate) {
    dateConditions.push(sql`${llmCallLogs.createdAt} >= ${params.startDate}`);
  }
  if (params?.endDate) {
    dateConditions.push(sql`${llmCallLogs.createdAt} <= ${params.endDate}`);
  }

  const rankings = await db
    .select({
      modelId: llmCallLogs.modelId,
      provider: llmCallLogs.provider,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`sum(${llmCallLogs.inputTokens})`,
      outputTokens: sql<number>`sum(${llmCallLogs.outputTokens})`,
      avgLatency: sql<number>`avg(${llmCallLogs.latency})`,
    })
    .from(llmCallLogs)
    .where(dateConditions.length > 0 ? sql.join(dateConditions, sql` AND `) : undefined)
    .groupBy(llmCallLogs.modelId, llmCallLogs.provider)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rankings.map((rank) => ({
    modelId: rank.modelId,
    provider: rank.provider,
    calls: Number(rank.calls),
    inputTokens: Number(rank.inputTokens || 0),
    outputTokens: Number(rank.outputTokens || 0),
    avgLatency: Number(rank.avgLatency || 0),
  }));
}

/**
 * 获取最近调用记录
 */
export async function getRecentCalls(params?: { limit?: number; userId?: number }) {
  const limit = params?.limit || 20;

  const calls = await db
    .select()
    .from(llmCallLogs)
    .orderBy(desc(llmCallLogs.createdAt))
    .limit(limit);

  return calls;
}

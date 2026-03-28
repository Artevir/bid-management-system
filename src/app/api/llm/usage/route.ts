/**
 * LLM用量统计 API
 * GET: 获取用量统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { db } from '@/db';
import { llmCallLogs, llmConfigs } from '@/db/llm-schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

// 获取用量统计
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const configId = searchParams.get('configId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const days = parseInt(searchParams.get('days') || '7');

    // 计算日期范围
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    switch (type) {
      case 'overview':
        return await getOverviewStats(start, end, configId);
      case 'daily':
        return await getDailyStats(start, end, configId);
      case 'models':
        return await getModelStats(start, end, configId);
      case 'recent':
        return await getRecentCalls(configId, 50);
      default:
        return await getOverviewStats(start, end, configId);
    }
  } catch (error) {
    console.error('获取LLM用量统计失败:', error);
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 });
  }
}

// 概览统计
async function getOverviewStats(start: Date, end: Date, configId?: string | null) {
  const conditions = [
    gte(llmCallLogs.createdAt, start),
    lte(llmCallLogs.createdAt, end),
  ];

  if (configId) {
    conditions.push(eq(llmCallLogs.configId, parseInt(configId)));
  }

  // 总体统计
  const [totalStats] = await db
    .select({
      totalCalls: sql<number>`count(*)`,
      successCalls: sql<number>`sum(case when status = 'success' then 1 else 0 end)`,
      failedCalls: sql<number>`sum(case when status = 'failed' then 1 else 0 end)`,
      totalInputTokens: sql<number>`coalesce(sum(input_tokens), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
      avgLatency: sql<number>`coalesce(avg(latency), 0)`,
    })
    .from(llmCallLogs)
    .where(and(...conditions));

  // 按提供商统计
  const providerStats = await db
    .select({
      provider: llmCallLogs.provider,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(input_tokens), 0)`,
      outputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
    })
    .from(llmCallLogs)
    .where(and(...conditions))
    .groupBy(llmCallLogs.provider);

  // 按模型统计
  const modelStats = await db
    .select({
      modelId: llmCallLogs.modelId,
      provider: llmCallLogs.provider,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(input_tokens), 0)`,
      outputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
      avgLatency: sql<number>`coalesce(avg(latency), 0)`,
    })
    .from(llmCallLogs)
    .where(and(...conditions))
    .groupBy(llmCallLogs.modelId, llmCallLogs.provider)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // 按配置统计
  const configStats = await db
    .select({
      configId: llmCallLogs.configId,
      configName: llmConfigs.name,
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(input_tokens), 0)`,
      outputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
    })
    .from(llmCallLogs)
    .leftJoin(llmConfigs, eq(llmCallLogs.configId, llmConfigs.id))
    .where(and(...conditions))
    .groupBy(llmCallLogs.configId, llmConfigs.name)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return NextResponse.json({
    overview: {
      ...totalStats,
      totalTokens: Number(totalStats.totalInputTokens) + Number(totalStats.totalOutputTokens),
    },
    byProvider: providerStats,
    byModel: modelStats,
    byConfig: configStats,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
}

// 每日统计
async function getDailyStats(start: Date, end: Date, configId?: string | null) {
  const conditions = [
    gte(llmCallLogs.createdAt, start),
    lte(llmCallLogs.createdAt, end),
  ];

  if (configId) {
    conditions.push(eq(llmCallLogs.configId, parseInt(configId)));
  }

  const dailyStats = await db
    .select({
      date: sql<string>`date(created_at)`,
      calls: sql<number>`count(*)`,
      successCalls: sql<number>`sum(case when status = 'success' then 1 else 0 end)`,
      failedCalls: sql<number>`sum(case when status = 'failed' then 1 else 0 end)`,
      inputTokens: sql<number>`coalesce(sum(input_tokens), 0)`,
      outputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
      avgLatency: sql<number>`coalesce(avg(latency), 0)`,
    })
    .from(llmCallLogs)
    .where(and(...conditions))
    .groupBy(sql`date(created_at)`)
    .orderBy(sql`date(created_at)`);

  return NextResponse.json({
    daily: dailyStats,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
}

// 按模型详细统计
async function getModelStats(start: Date, end: Date, configId?: string | null) {
  const conditions = [
    gte(llmCallLogs.createdAt, start),
    lte(llmCallLogs.createdAt, end),
  ];

  if (configId) {
    conditions.push(eq(llmCallLogs.configId, parseInt(configId)));
  }

  const modelStats = await db
    .select({
      modelId: llmCallLogs.modelId,
      provider: llmCallLogs.provider,
      calls: sql<number>`count(*)`,
      successCalls: sql<number>`sum(case when status = 'success' then 1 else 0 end)`,
      failedCalls: sql<number>`sum(case when status = 'failed' then 1 else 0 end)`,
      inputTokens: sql<number>`coalesce(sum(input_tokens), 0)`,
      outputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
      avgLatency: sql<number>`coalesce(avg(latency), 0)`,
      maxLatency: sql<number>`coalesce(max(latency), 0)`,
      minLatency: sql<number>`coalesce(min(latency), 0)`,
    })
    .from(llmCallLogs)
    .where(and(...conditions))
    .groupBy(llmCallLogs.modelId, llmCallLogs.provider)
    .orderBy(desc(sql`count(*)`));

  return NextResponse.json({
    models: modelStats,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  });
}

// 最近调用记录
async function getRecentCalls(configId?: string | null, limit: number = 50) {
  const conditions = [];

  if (configId) {
    conditions.push(eq(llmCallLogs.configId, parseInt(configId)));
  }

  const calls = await db
    .select({
      id: llmCallLogs.id,
      configId: llmCallLogs.configId,
      configName: llmConfigs.name,
      modelId: llmCallLogs.modelId,
      provider: llmCallLogs.provider,
      inputTokens: llmCallLogs.inputTokens,
      outputTokens: llmCallLogs.outputTokens,
      latency: llmCallLogs.latency,
      firstTokenLatency: llmCallLogs.firstTokenLatency,
      status: llmCallLogs.status,
      errorMessage: llmCallLogs.errorMessage,
      callContext: llmCallLogs.callContext,
      createdAt: llmCallLogs.createdAt,
    })
    .from(llmCallLogs)
    .leftJoin(llmConfigs, eq(llmCallLogs.configId, llmConfigs.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(llmCallLogs.createdAt))
    .limit(limit);

  return NextResponse.json({ calls });
}

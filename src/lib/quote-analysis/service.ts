/**
 * 智能报价建议服务
 * 提供报价分析、竞争对手预测、报价方案生成等功能
 */

import { db } from '@/db';
import {
  quoteAnalysisRequests,
  quoteFactors,
  competitorQuotePredictions,
  quoteSchemes,
  quoteHistoryComparisons,
  historicalQuotes,
  competitors,
  projects as _projects,
  type QuoteAnalysisRequest,
  type NewQuoteAnalysisRequest,
  type QuoteFactor,
  type NewQuoteFactor,
  type CompetitorQuotePrediction,
  type NewCompetitorQuotePrediction,
  type QuoteScheme,
  type NewQuoteScheme,
  type QuoteHistoryComparison,
  type NewQuoteHistoryComparison,
} from '@/db/schema';
import { eq, and, desc, sql, lte as _lte, gte as _gte, inArray as _inArray, isNull as _isNull, or as _or, ilike } from 'drizzle-orm';
import { LLMClient as _LLMClient } from 'coze-coding-dev-sdk';

// ============================================
// 报价分析请求管理
// ============================================

export async function createQuoteAnalysisRequest(data: NewQuoteAnalysisRequest): Promise<QuoteAnalysisRequest> {
  const [request] = await db.insert(quoteAnalysisRequests).values(data).returning();
  return request;
}

export async function getQuoteAnalysisRequests(filters?: {
  projectId?: number;
  status?: string;
  strategy?: string;
  createdBy?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ data: QuoteAnalysisRequest[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(quoteAnalysisRequests.projectId, filters.projectId));
  }
  if (filters?.status) {
    conditions.push(eq(quoteAnalysisRequests.status, filters.status as any));
  }
  if (filters?.strategy) {
    conditions.push(eq(quoteAnalysisRequests.strategy, filters.strategy as any));
  }
  if (filters?.createdBy) {
    conditions.push(eq(quoteAnalysisRequests.createdBy, filters.createdBy));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(quoteAnalysisRequests)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(quoteAnalysisRequests)
    .where(whereClause)
    .orderBy(desc(quoteAnalysisRequests.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

export async function getQuoteAnalysisRequestById(id: number): Promise<QuoteAnalysisRequest | null> {
  const [request] = await db
    .select()
    .from(quoteAnalysisRequests)
    .where(eq(quoteAnalysisRequests.id, id))
    .limit(1);
  return request || null;
}

export async function updateQuoteAnalysisRequest(id: number, data: Partial<NewQuoteAnalysisRequest>): Promise<QuoteAnalysisRequest> {
  const [request] = await db
    .update(quoteAnalysisRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(quoteAnalysisRequests.id, id))
    .returning();
  return request;
}

// ============================================
// 报价因素管理
// ============================================

export async function createQuoteFactor(data: NewQuoteFactor): Promise<QuoteFactor> {
  const [factor] = await db.insert(quoteFactors).values(data).returning();
  return factor;
}

export async function getQuoteFactorsByRequestId(requestId: number): Promise<QuoteFactor[]> {
  return db
    .select()
    .from(quoteFactors)
    .where(eq(quoteFactors.requestId, requestId))
    .orderBy(quoteFactors.sortOrder);
}

// ============================================
// 竞争对手报价预测管理
// ============================================

export async function createCompetitorPrediction(data: NewCompetitorQuotePrediction): Promise<CompetitorQuotePrediction> {
  const [prediction] = await db.insert(competitorQuotePredictions).values(data).returning();
  return prediction;
}

export async function getCompetitorPredictionsByRequestId(requestId: number): Promise<CompetitorQuotePrediction[]> {
  const results = await db
    .select()
    .from(competitorQuotePredictions)
    .where(eq(competitorQuotePredictions.requestId, requestId));
  
  return results;
}

// ============================================
// 报价方案管理
// ============================================

export async function createQuoteScheme(data: NewQuoteScheme): Promise<QuoteScheme> {
  const [scheme] = await db.insert(quoteSchemes).values(data).returning();
  return scheme;
}

export async function getQuoteSchemesByRequestId(requestId: number): Promise<QuoteScheme[]> {
  return db
    .select()
    .from(quoteSchemes)
    .where(eq(quoteSchemes.requestId, requestId))
    .orderBy(quoteSchemes.sortOrder);
}

export async function adoptQuoteScheme(id: number, userId: number): Promise<QuoteScheme> {
  // 先取消其他方案的采纳状态
  const scheme = await db
    .select()
    .from(quoteSchemes)
    .where(eq(quoteSchemes.id, id))
    .limit(1);

  if (scheme.length === 0) {
    throw new Error('报价方案不存在');
  }

  // 取消同一请求下其他方案的采纳状态
  await db
    .update(quoteSchemes)
    .set({ isAdopted: false, adoptedAt: null, adoptedBy: null })
    .where(
      and(
        eq(quoteSchemes.requestId, scheme[0].requestId),
        eq(quoteSchemes.isAdopted, true)
      )
    );

  // 采纳当前方案
  const [updated] = await db
    .update(quoteSchemes)
    .set({
      isAdopted: true,
      adoptedAt: new Date(),
      adoptedBy: userId,
    })
    .where(eq(quoteSchemes.id, id))
    .returning();

  return updated;
}

// ============================================
// 历史对比管理
// ============================================

export async function createHistoryComparison(data: NewQuoteHistoryComparison): Promise<QuoteHistoryComparison> {
  const [comparison] = await db.insert(quoteHistoryComparisons).values(data).returning();
  return comparison;
}

export async function getHistoryComparisonsByRequestId(requestId: number): Promise<QuoteHistoryComparison[]> {
  return db
    .select()
    .from(quoteHistoryComparisons)
    .where(eq(quoteHistoryComparisons.requestId, requestId));
}

// ============================================
// 智能分析功能
// ============================================

/**
 * 执行智能报价分析
 */
export async function performQuoteAnalysis(requestId: number): Promise<{
  factors: QuoteFactor[];
  predictions: CompetitorQuotePrediction[];
  schemes: QuoteScheme[];
  historyComparisons: QuoteHistoryComparison[];
}> {
  const request = await getQuoteAnalysisRequestById(requestId);
  if (!request) {
    throw new Error('报价分析请求不存在');
  }

  // 更新状态为分析中
  await updateQuoteAnalysisRequest(requestId, {
    status: 'analyzing',
    startedAt: new Date(),
  });

  try {
    // 1. 分析报价因素
    const factors = await analyzeQuoteFactors(request);

    // 2. 预测竞争对手报价
    const predictions = await predictCompetitorQuotes(request);

    // 3. 查找相似历史项目
    const historyComparisons = await findSimilarHistoricalProjects(request);

    // 4. 生成报价方案
    const schemes = await generateQuoteSchemes(request, factors, predictions);

    // 更新分析结果
    await updateQuoteAnalysisRequest(requestId, {
      status: 'completed',
      completedAt: new Date(),
      analysisResult: JSON.stringify({
        factors: factors.length,
        predictions: predictions.length,
        schemes: schemes.length,
        historyComparisons: historyComparisons.length,
      }),
    });

    return { factors, predictions, schemes, historyComparisons };
  } catch (error) {
    await updateQuoteAnalysisRequest(requestId, {
      status: 'failed',
      analysisNotes: `分析失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
    throw error;
  }
}

/**
 * 分析报价因素
 */
async function analyzeQuoteFactors(request: QuoteAnalysisRequest): Promise<QuoteFactor[]> {
  const factors: NewQuoteFactor[] = [];

  // 预算因素
  if (request.budget) {
    factors.push({
      requestId: request.id,
      factorName: '项目预算',
      factorType: 'cost',
      weight: 30,
      description: `项目预算金额: ${request.budget}`,
      dataSource: 'user_input',
      sortOrder: 1,
    });
  }

  // 行业因素
  if (request.industry) {
    factors.push({
      requestId: request.id,
      factorName: '行业特点',
      factorType: 'market',
      weight: 20,
      description: `所属行业: ${request.industry}`,
      dataSource: 'user_input',
      sortOrder: 2,
    });
  }

  // 地区因素
  if (request.region) {
    factors.push({
      requestId: request.id,
      factorName: '地区因素',
      factorType: 'market',
      weight: 15,
      description: `项目地区: ${request.region}`,
      dataSource: 'user_input',
      sortOrder: 3,
    });
  }

  // 竞争因素
  if (request.knownCompetitors) {
    const competitors = JSON.parse(request.knownCompetitors as string);
    factors.push({
      requestId: request.id,
      factorName: '竞争态势',
      factorType: 'competition',
      weight: 25,
      description: `已知竞争对手数量: ${competitors.length}`,
      dataSource: 'user_input',
      sortOrder: 4,
    });
  }

  // 评分方法因素
  if (request.priceWeight) {
    factors.push({
      requestId: request.id,
      factorName: '报价权重',
      factorType: 'cost',
      weight: 10,
      description: `报价评分权重: ${request.priceWeight}%`,
      dataSource: 'user_input',
      sortOrder: 5,
    });
  }

  // 使用AI分析额外因素
  try {
    const config = new (await import('coze-coding-dev-sdk')).Config();
    const LLMClient = (await import('coze-coding-dev-sdk')).LLMClient;
    const client = new LLMClient(config);
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: '你是一个投标报价分析专家，请分析以下项目信息，给出影响报价的关键因素建议。',
      },
      {
        role: 'user',
        content: `项目名称: ${request.projectName}
行业: ${request.industry || '未知'}
地区: ${request.region || '未知'}
预算: ${request.budget || '未知'}
报价策略: ${request.strategy}
请以JSON格式返回3-5个关键报价因素，格式: [{"name":"因素名称","type":"类型","weight":权重,"description":"描述"}`,
      },
    ];
    
    const response = await client.invoke(messages, { temperature: 0.7 });
    const aiAnalysis = response.content;

    // 解析AI返回的因素
    const content = aiAnalysis;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const aiFactors = JSON.parse(jsonMatch[0]);
      for (const f of aiFactors) {
        factors.push({
          requestId: request.id,
          factorName: f.name,
          factorType: f.type || 'market',
          weight: f.weight || 10,
          description: f.description,
          dataSource: 'ai_analysis',
          sortOrder: factors.length + 1,
        });
      }
    }
  } catch (error) {
    console.error('AI分析报价因素失败:', error);
  }

  // 保存因素
  const savedFactors: QuoteFactor[] = [];
  for (const factor of factors) {
    savedFactors.push(await createQuoteFactor(factor));
  }

  return savedFactors;
}

/**
 * 预测竞争对手报价
 */
async function predictCompetitorQuotes(request: QuoteAnalysisRequest): Promise<CompetitorQuotePrediction[]> {
  const predictions: CompetitorQuotePrediction[] = [];

  // 解析已知竞争对手
  let competitorNames: string[] = [];
  if (request.knownCompetitors) {
    try {
      competitorNames = JSON.parse(request.knownCompetitors as string);
    } catch {
      competitorNames = [];
    }
  }

  // 获取历史数据中的竞争对手
  const historicalCompetitors = await db
    .select()
    .from(competitors)
    .where(eq(competitors.status, 'active'))
    .limit(10);

  // 为每个竞争对手生成预测
  const allCompetitors = [...new Set([...competitorNames, ...historicalCompetitors.map(c => c.name)])];

  for (const name of allCompetitors.slice(0, 5)) {
    // 查询该竞争对手的历史数据
    const historicalData = await db
      .select()
      .from(historicalQuotes)
      .where(ilike(historicalQuotes.projectName, `%${name}%`))
      .limit(5);

    let predictedQuote = '';
    let confidence = 50;
    const avgDeviation = '0%';

    if (historicalData.length > 0) {
      // 基于历史数据计算预测
      const quotes = historicalData
        .filter(h => h.ourQuote)
        .map(h => parseFloat(h.ourQuote || '0'));
      
      if (quotes.length > 0) {
        const avgQuote = quotes.reduce((a, b) => a + b, 0) / quotes.length;
        predictedQuote = avgQuote.toFixed(2);
        confidence = 60 + Math.min(historicalData.length * 5, 30);
      }
    } else {
      // 无历史数据时使用估算
      if (request.budget) {
        const budget = parseFloat(request.budget.replace(/[^\d.]/g, ''));
        if (!isNaN(budget)) {
          predictedQuote = (budget * 0.85 + Math.random() * budget * 0.1).toFixed(2);
        }
      }
      confidence = 30;
    }

    const prediction = await createCompetitorPrediction({
      requestId: request.id,
      competitorId: historicalCompetitors.find(c => c.name === name)?.id || null,
      competitorName: name,
      predictedQuote,
      predictedQuoteRange: predictedQuote ? `${(parseFloat(predictedQuote) * 0.95).toFixed(2)}-${(parseFloat(predictedQuote) * 1.05).toFixed(2)}` : null,
      confidence,
      basis: historicalData.length > 0 ? JSON.stringify({ historicalCount: historicalData.length }) : null,
      historicalWinRate: historicalData.filter(h => h.result === 'won').length / (historicalData.length || 1) * 100 || null,
      avgQuoteDeviation: avgDeviation,
    });

    predictions.push(prediction);
  }

  return predictions;
}

/**
 * 查找相似历史项目
 */
async function findSimilarHistoricalProjects(request: QuoteAnalysisRequest): Promise<QuoteHistoryComparison[]> {
  const comparisons: QuoteHistoryComparison[] = [];

  // 构建查询条件
  const conditions = [];
  if (request.industry) {
    conditions.push(eq(historicalQuotes.industry, request.industry));
  }
  if (request.region) {
    conditions.push(eq(historicalQuotes.region, request.region));
  }

  // 查询历史项目
  const historicalProjects = await db
    .select()
    .from(historicalQuotes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(5);

  // 计算相似度并创建对比记录
  for (const hp of historicalProjects) {
    let similarity = 50;
    
    // 计算相似度
    if (hp.industry === request.industry) similarity += 20;
    if (hp.region === request.region) similarity += 15;
    if (hp.projectType === request.projectType) similarity += 15;

    similarity = Math.min(similarity, 100);

    const comparison = await createHistoryComparison({
      requestId: request.id,
      historicalQuoteId: hp.id,
      historicalProjectName: hp.projectName,
      historicalProjectType: hp.projectType || null,
      historicalIndustry: hp.industry || null,
      historicalRegion: hp.region || null,
      similarity,
      historicalBudget: hp.budget || null,
      historicalWinningQuote: hp.winningQuote || null,
      historicalOurQuote: hp.ourQuote || null,
      historicalResult: hp.result,
      referenceValue: `相似度${similarity}%，${hp.result === 'won' ? '已中标' : '未中标'}`,
    });

    comparisons.push(comparison);
  }

  return comparisons;
}

/**
 * 生成报价方案
 */
async function generateQuoteSchemes(
  request: QuoteAnalysisRequest,
  factors: QuoteFactor[],
  predictions: CompetitorQuotePrediction[]
): Promise<QuoteScheme[]> {
  const schemes: QuoteScheme[] = [];

  // 计算基准报价
  let baseQuote = 0;
  if (request.budget) {
    const budget = parseFloat(request.budget.replace(/[^\d.]/g, ''));
    if (!isNaN(budget)) {
      baseQuote = budget * 0.9; // 默认以预算的90%为基准
    }
  }

  // 计算竞争对手平均报价
  const competitorQuotes = predictions
    .filter(p => p.predictedQuote)
    .map(p => parseFloat(p.predictedQuote || '0'))
    .filter(q => q > 0);
  
  const avgCompetitorQuote = competitorQuotes.length > 0
    ? competitorQuotes.reduce((a, b) => a + b, 0) / competitorQuotes.length
    : baseQuote * 0.92;

  // 1. 激进方案
  const aggressiveQuote = Math.min(baseQuote * 0.85, avgCompetitorQuote * 0.95);
  schemes.push(await createQuoteScheme({
    requestId: request.id,
    schemeName: '激进报价方案',
    schemeType: 'aggressive',
    quoteAmount: aggressiveQuote.toFixed(2),
    expectedProfit: (aggressiveQuote * 0.1).toFixed(2),
    profitRate: '10%',
    winProbability: 85,
    riskLevel: 'high',
    riskFactors: JSON.stringify(['利润率较低', '成本控制要求高', '可能影响服务质量']),
    description: '以低价优势争取中标，适合急需打开市场或竞争激烈的情况',
    pros: '中标概率高，能够快速占领市场',
    cons: '利润率低，执行压力大',
    sortOrder: 1,
  }));

  // 2. 平衡方案
  const balancedQuote = avgCompetitorQuote * 0.98;
  schemes.push(await createQuoteScheme({
    requestId: request.id,
    schemeName: '平衡报价方案',
    schemeType: 'balanced',
    quoteAmount: balancedQuote.toFixed(2),
    expectedProfit: (balancedQuote * 0.15).toFixed(2),
    profitRate: '15%',
    winProbability: 60,
    riskLevel: 'medium',
    riskFactors: JSON.stringify(['竞争态势不确定', '评分标准可能有变化']),
    description: '兼顾中标概率和合理利润，是较为稳妥的选择',
    pros: '利润率合理，风险适中',
    cons: '中标概率不如激进方案',
    sortOrder: 2,
  }));

  // 3. 保守方案
  const conservativeQuote = avgCompetitorQuote * 1.02;
  schemes.push(await createQuoteScheme({
    requestId: request.id,
    schemeName: '保守报价方案',
    schemeType: 'conservative',
    quoteAmount: conservativeQuote.toFixed(2),
    expectedProfit: (conservativeQuote * 0.2).toFixed(2),
    profitRate: '20%',
    winProbability: 35,
    riskLevel: 'low',
    riskFactors: JSON.stringify(['可能因价格因素失分', '竞争对手可能低价竞标']),
    description: '注重利润率，适合项目利润要求高或有技术优势的情况',
    pros: '利润率高，执行压力小',
    cons: '中标概率较低',
    sortOrder: 3,
  }));

  return schemes;
}

// ============================================
// 统计分析
// ============================================

export async function getQuoteAnalysisStatistics(createdBy?: number): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byStrategy: Record<string, number>;
  avgWinProbability: number;
  adoptedSchemes: number;
}> {
  const conditions = createdBy ? [eq(quoteAnalysisRequests.createdBy, createdBy)] : [];

  const requests = await db
    .select()
    .from(quoteAnalysisRequests)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // 获取采纳方案数
  const adoptedCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(quoteSchemes)
    .where(eq(quoteSchemes.isAdopted, true));

  const stats = {
    total: requests.length,
    byStatus: {} as Record<string, number>,
    byStrategy: {} as Record<string, number>,
    avgWinProbability: 0,
    adoptedSchemes: Number(adoptedCount[0]?.count || 0),
  };

  let totalWinProb = 0;
  let winProbCount = 0;

  for (const r of requests) {
    stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;
    stats.byStrategy[r.strategy] = (stats.byStrategy[r.strategy] || 0) + 1;

    // 从分析结果中提取中标概率
    if (r.analysisResult) {
      try {
        const result = JSON.parse(r.analysisResult as string);
        if (result.winProbability) {
          totalWinProb += result.winProbability;
          winProbCount++;
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  stats.avgWinProbability = winProbCount > 0 ? Math.round(totalWinProb / winProbCount) : 0;

  return stats;
}

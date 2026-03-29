import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { historicalQuotes, competitors, competitorBids as _competitorBids } from '@/db/schema';
import { eq, and, gte as _gte, lte as _lte, sql as _sql, desc, isNotNull } from 'drizzle-orm';

/**
 * 智能报价分析API
 * GET /api/quotes/analyze
 * 
 * 参数:
 * - budget: 预算金额
 * - industry: 行业
 * - region: 地区
 * - projectType: 项目类型
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const budget = parseFloat(searchParams.get('budget') || '0');
    const industry = searchParams.get('industry');
    const region = searchParams.get('region');
    const projectType = searchParams.get('projectType');

    if (!budget) {
      return NextResponse.json(
        { error: '请提供预算金额' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const conditions = [isNotNull(historicalQuotes.winningQuote)];
    if (industry) conditions.push(eq(historicalQuotes.industry, industry));
    if (region) conditions.push(eq(historicalQuotes.region, region));
    if (projectType) conditions.push(eq(historicalQuotes.projectType, projectType));

    // 获取历史数据
    const historicalData = await db
      .select()
      .from(historicalQuotes)
      .where(and(...conditions))
      .orderBy(desc(historicalQuotes.bidDate))
      .limit(100);

    if (historicalData.length === 0) {
      // 无历史数据时返回基于预算的建议
      return NextResponse.json({
        success: true,
        analysis: {
          hasEnoughData: false,
          message: '历史数据不足，以下建议仅供参考',
          recommendations: generateBasicRecommendations(budget),
        },
      });
    }

    // 计算统计数据
    const stats = calculateStatistics(historicalData, budget);
    
    // 生成报价建议
    const recommendations = generateRecommendations(stats, budget, historicalData);
    
    // 分析竞争对手
    const competitorAnalysis = await analyzeCompetitors(industry, region);

    return NextResponse.json({
      success: true,
      analysis: {
        hasEnoughData: true,
        stats,
        recommendations,
        competitorAnalysis,
        dataPoints: historicalData.length,
      },
    });
  } catch (error) {
    console.error('Failed to analyze quotes:', error);
    return NextResponse.json(
      { error: '报价分析失败' },
      { status: 500 }
    );
  }
}

/**
 * 计算统计数据
 */
function calculateStatistics(data: any[], budget: number) {
  const winningQuotes = data
    .filter(d => d.winningQuote)
    .map(d => parseFloat(d.winningQuote));
  
  const budgetRatios = data
    .filter(d => d.budget && d.winningQuote)
    .map(d => parseFloat(d.winningQuote) / parseFloat(d.budget) * 100);

  const winRateByDeviation = data.reduce((acc, d) => {
    if (d.quoteDeviation) {
      const deviation = parseFloat(d.quoteDeviation);
      const range = Math.floor(deviation / 5) * 5; // 5%区间
      if (!acc[range]) {
        acc[range] = { total: 0, won: 0 };
      }
      acc[range].total++;
      if (d.result === 'won') acc[range].won++;
    }
    return acc;
  }, {} as Record<number, { total: number; won: number }>);

  const avgWinningQuote = winningQuotes.length > 0
    ? winningQuotes.reduce((a, b) => a + b, 0) / winningQuotes.length
    : 0;

  const avgBudgetRatio = budgetRatios.length > 0
    ? budgetRatios.reduce((a, b) => a + b, 0) / budgetRatios.length
    : 90; // 默认90%

  // 预测中标价
  const predictedWinningQuote = budget * (avgBudgetRatio / 100);

  // 计算最佳报价区间
  const optimalRange = {
    min: predictedWinningQuote * 0.95,
    max: predictedWinningQuote * 1.02,
    recommended: predictedWinningQuote * 0.98,
  };

  return {
    avgWinningQuote,
    avgBudgetRatio,
    predictedWinningQuote,
    optimalRange,
    sampleSize: data.length,
    winRateByDeviation,
    historicalWins: data.filter(d => d.result === 'won').length,
    historicalLosses: data.filter(d => d.result === 'lost').length,
  };
}

/**
 * 生成报价建议
 */
function generateRecommendations(stats: any, _budget: number, _data: any[]) {
  const recommendations = [];
  
  // 基本建议
  recommendations.push({
    type: 'range',
    title: '建议报价区间',
    content: `基于历史数据分析，建议报价区间为 ${formatCurrency(stats.optimalRange.min)} - ${formatCurrency(stats.optimalRange.max)}`,
    details: {
      min: stats.optimalRange.min,
      max: stats.optimalRange.max,
      recommended: stats.optimalRange.recommended,
    },
    confidence: calculateConfidence(stats.sampleSize),
  });

  // 中标率分析
  const winRateEntries = Object.entries(stats.winRateByDeviation) as [string, { total: number; won: number }][];
  const bestDeviationRange = winRateEntries
    .map(([range, data]) => ({
      range: parseInt(range),
      winRate: data.won / data.total,
      sampleSize: data.total,
    }))
    .filter(d => d.sampleSize >= 3)
    .sort((a, b) => b.winRate - a.winRate)[0];

  if (bestDeviationRange) {
    const deviationAdvice = bestDeviationRange.range <= -5
      ? '低于平均报价可提高中标率'
      : bestDeviationRange.range >= 5
      ? '高于平均报价会降低中标率，需在技术方案上有明显优势'
      : '接近平均报价是较为稳妥的选择';
    
    recommendations.push({
      type: 'strategy',
      title: '报价策略建议',
      content: `历史数据显示，报价偏差在${bestDeviationRange.range}%~${bestDeviationRange.range + 5}%区间时中标率为${(bestDeviationRange.winRate * 100).toFixed(1)}%。${deviationAdvice}`,
      confidence: calculateConfidence(bestDeviationRange.sampleSize),
    });
  }

  // 风险提示
  if (stats.avgBudgetRatio < 85) {
    recommendations.push({
      type: 'warning',
      title: '低价竞争风险',
      content: `该行业历史中标价平均为预算的${stats.avgBudgetRatio.toFixed(1)}%，存在低价竞争趋势。请评估成本效益比。`,
      severity: 'medium',
    });
  }

  if (stats.avgBudgetRatio > 95) {
    recommendations.push({
      type: 'info',
      title: '高价区间提示',
      content: `该行业历史中标价平均为预算的${stats.avgBudgetRatio.toFixed(1)}%，接近预算上限。技术方案质量可能是关键因素。`,
      severity: 'low',
    });
  }

  return recommendations;
}

/**
 * 分析竞争对手
 */
async function analyzeCompetitors(_industry: string | null, _region: string | null) {
  try {
    const conditions = [eq(competitors.status, 'active')];
    
    const competitorsData = await db
      .select()
      .from(competitors)
      .where(and(...conditions))
      .orderBy(desc(competitors.winRate))
      .limit(10);

    if (competitorsData.length === 0) {
      return null;
    }

    return {
      topCompetitors: competitorsData.map((c: any) => ({
        id: c.id,
        name: c.name,
        winRate: c.winRate ? parseFloat(c.winRate) : 0,
        totalBids: c.totalBids,
        strength: c.strength,
        avgQuoteDeviation: c.avgQuoteDeviation ? parseFloat(c.avgQuoteDeviation) : null,
      })),
      warning: competitorsData.filter((c: any) => c.strength === 'strong').length > 0
        ? '存在强势竞争对手，建议在技术方案和服务承诺上突出优势'
        : null,
    };
  } catch (error) {
    console.error('Failed to analyze competitors:', error);
    return null;
  }
}

/**
 * 生成基础建议（无历史数据时）
 */
function generateBasicRecommendations(budget: number) {
  return [
    {
      type: 'range',
      title: '建议报价区间（基础）',
      content: `基于行业常规，建议报价区间为 ${formatCurrency(budget * 0.85)} - ${formatCurrency(budget * 0.95)}`,
      details: {
        min: budget * 0.85,
        max: budget * 0.95,
        recommended: budget * 0.90,
      },
      confidence: 'low',
    },
    {
      type: 'info',
      title: '数据不足提示',
      content: '历史报价数据不足，建议积累更多投标数据以提高分析准确性。当前建议仅供参考。',
      severity: 'medium',
    },
  ];
}

/**
 * 计算置信度
 */
function calculateConfidence(sampleSize: number): 'high' | 'medium' | 'low' {
  if (sampleSize >= 30) return 'high';
  if (sampleSize >= 10) return 'medium';
  return 'low';
}

/**
 * 格式化货币
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

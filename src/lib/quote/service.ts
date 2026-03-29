/**
 * 智能报价建议服务
 * 基于历史分析、成本模型、报价策略提供智能报价建议
 */

import { db } from '@/db';
import { historicalQuotes, bidOpenings, bidOpeningQuotes, competitors as _competitors, projects as _projects } from '@/db/schema';
import { eq, and, gte as _gte, lte as _lte, desc, sql as _sql, avg as _avg } from 'drizzle-orm';

// ============================================
// 报价建议类型定义
// ============================================

export interface QuoteSuggestion {
  suggestedPrice: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  priceRange: {
    min: number;
    max: number;
  };
  analysis: {
    historicalAvg: number;
    competitorAvg: number;
    budgetPrice?: number;
    winProbabilityAt: number;
  };
  factors: QuoteFactor[];
  recommendations: string[];
}

export interface QuoteFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface CostModel {
  directCosts: number;
  indirectCosts: number;
  profitMargin: number;
  riskReserve: number;
  taxAmount: number;
  totalCost: number;
}

// ============================================
// 历史数据分析服务
// ============================================

export class HistoricalAnalysisService {
  /**
   * 获取同类项目历史报价
   */
  async getHistoricalQuotes(params: {
    industry?: string;
    region?: string;
    minBudget?: number;
    maxBudget?: number;
    years?: number;
  }): Promise<{
    quotes: any[];
    statistics: {
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      winAvgPrice: number;
    };
  }> {
    const quotes = await db
      .select()
      .from(historicalQuotes)
      .where(
        and(
          params.industry ? eq(historicalQuotes.industry, params.industry) : undefined,
          params.region ? eq(historicalQuotes.region, params.region) : undefined,
        )
      )
      .orderBy(desc(historicalQuotes.bidDate))
      .limit(100);

    const prices = quotes
      .map((q) => parseFloat(q.ourQuote || '0'))
      .filter((p) => p > 0);

    const winPrices = quotes
      .filter((q) => q.result === 'won')
      .map((q) => parseFloat(q.ourQuote || '0'))
      .filter((p) => p > 0);

    return {
      quotes,
      statistics: {
        avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        winAvgPrice: winPrices.length > 0 ? winPrices.reduce((a, b) => a + b, 0) / winPrices.length : 0,
      },
    };
  }

  /**
   * 分析报价偏差
   */
  async analyzeQuoteDeviation(projectId: number): Promise<{
    ourDeviation: number;
    competitorAvgDeviation: number;
    analysis: string;
  }> {
    // 获取开标记录
    const openings = await db
      .select()
      .from(bidOpenings)
      .where(eq(bidOpenings.projectId, projectId));

    if (openings.length === 0) {
      return {
        ourDeviation: 0,
        competitorAvgDeviation: 0,
        analysis: '无历史开标记录',
      };
    }

    // 分析报价偏差
    let totalDeviation = 0;
    let competitorTotalDeviation = 0;
    let count = 0;

    for (const opening of openings) {
      const quotes = await db
        .select()
        .from(bidOpeningQuotes)
        .where(eq(bidOpeningQuotes.openingId, opening.id));

      const budgetPrice = opening.budgetPrice ? parseFloat(opening.budgetPrice) : 0;
      if (budgetPrice === 0) continue;

      const ourQuote = quotes.find((q) => q.bidderType === 'us');
      if (ourQuote && ourQuote.bidPrice) {
        totalDeviation += (parseFloat(ourQuote.bidPrice) - budgetPrice) / budgetPrice;
        count++;
      }

      const competitorQuotes = quotes.filter((q) => q.bidderType === 'competitor');
      for (const cq of competitorQuotes) {
        if (cq.bidPrice) {
          competitorTotalDeviation += (parseFloat(cq.bidPrice) - budgetPrice) / budgetPrice;
        }
      }
    }

    return {
      ourDeviation: count > 0 ? totalDeviation / count : 0,
      competitorAvgDeviation: competitorTotalDeviation / Math.max(count, 1),
      analysis: count > 0 ? `共分析 ${count} 次投标记录` : '无有效数据',
    };
  }

  /**
   * 获取中标率与报价关系
   */
  async getWinRateByPriceRange(industry?: string): Promise<{
    range: string;
    winRate: number;
    avgPrice: number;
  }[]> {
    // 按报价区间统计中标率
    const quotes = await db
      .select()
      .from(historicalQuotes)
      .where(industry ? eq(historicalQuotes.industry, industry) : undefined);

    const ranges = [
      { min: 0, max: 0.85, label: '低于预算15%以上' },
      { min: 0.85, max: 0.95, label: '低于预算5-15%' },
      { min: 0.95, max: 1.0, label: '接近预算' },
      { min: 1.0, max: 1.05, label: '高于预算5%以内' },
      { min: 1.05, max: Infinity, label: '高于预算5%以上' },
    ];

    return ranges.map((range) => {
      const inRange = quotes.filter((q) => {
        const price = parseFloat(q.ourQuote || '0');
        const budget = q.budget ? parseFloat(q.budget) : 1;
        const ratio = budget > 0 ? price / budget : 0;
        return ratio >= range.min && ratio < range.max;
      });

      const wins = inRange.filter((q) => q.result === 'won');
      const avgPrice = inRange.length > 0
        ? inRange.reduce((sum, q) => sum + parseFloat(q.ourQuote || '0'), 0) / inRange.length
        : 0;

      return {
        range: range.label,
        winRate: inRange.length > 0 ? wins.length / inRange.length : 0,
        avgPrice,
      };
    });
  }
}

// ============================================
// 成本模型服务
// ============================================

export class CostModelService {
  /**
   * 计算项目成本
   */
  calculateCost(params: {
    directCosts: number;
    indirectRate: number;
    profitMargin: number;
    riskRate: number;
    taxRate: number;
  }): CostModel {
    const indirectCosts = params.directCosts * params.indirectRate;
    const subtotal = params.directCosts + indirectCosts;
    const profit = subtotal * params.profitMargin;
    const risk = subtotal * params.riskRate;
    const preTax = subtotal + profit + risk;
    const taxAmount = preTax * params.taxRate;
    const totalCost = preTax + taxAmount;

    return {
      directCosts: params.directCosts,
      indirectCosts,
      profitMargin: params.profitMargin,
      riskReserve: risk,
      taxAmount,
      totalCost,
    };
  }

  /**
   * 估算直接成本
   */
  async estimateDirectCosts(_projectId: number): Promise<{
    materialCost: number;
    laborCost: number;
    equipmentCost: number;
    otherCost: number;
    total: number;
    breakdown: Record<string, number>;
  }> {
    // TODO: 基于项目内容估算成本
    // 这里返回模拟数据
    const materialCost = 100000;
    const laborCost = 50000;
    const equipmentCost = 20000;
    const otherCost = 10000;

    return {
      materialCost,
      laborCost,
      equipmentCost,
      otherCost,
      total: materialCost + laborCost + equipmentCost + otherCost,
      breakdown: {
        '材料费': materialCost,
        '人工费': laborCost,
        '设备费': equipmentCost,
        '其他费用': otherCost,
      },
    };
  }

  /**
   * 获取行业标准利润率
   */
  getIndustryProfitMargin(industry: string): number {
    const margins: Record<string, number> = {
      '建筑施工': 0.08,
      '软件开发': 0.15,
      '咨询服务': 0.20,
      '设备采购': 0.10,
      '工程服务': 0.12,
    };
    return margins[industry] || 0.10;
  }
}

// ============================================
// 报价策略服务
// ============================================

export class QuoteStrategyService {
  private historicalService: HistoricalAnalysisService;
  private costService: CostModelService;

  constructor() {
    this.historicalService = new HistoricalAnalysisService();
    this.costService = new CostModelService();
  }

  /**
   * 生成报价建议
   */
  async generateSuggestion(params: {
    projectId: number;
    budgetPrice?: number;
    industry?: string;
    region?: string;
    costEstimate?: number;
    strategy: 'aggressive' | 'balanced' | 'conservative';
  }): Promise<QuoteSuggestion> {
    // 1. 获取历史数据分析
    const historical = await this.historicalService.getHistoricalQuotes({
      industry: params.industry,
      region: params.region,
    });

    // 2. 计算成本
    const cost = params.costEstimate || await this.estimateTotalCost(params.projectId);

    // 3. 获取竞争对手分析
    const competitorAnalysis = await this.analyzeCompetitors(params.industry);

    // 4. 根据策略调整
    const strategyAdjustment = this.getStrategyAdjustment(params.strategy);

    // 5. 计算建议报价
    let basePrice = historical.statistics.winAvgPrice || historical.statistics.avgPrice;
    
    if (params.budgetPrice) {
      // 如果有预算价，以预算价为基础
      basePrice = params.budgetPrice * (params.strategy === 'aggressive' ? 0.92 : params.strategy === 'conservative' ? 0.98 : 0.95);
    }

    // 确保不低于成本
    const minPrice = cost * 1.05; // 至少5%利润
    const suggestedPrice = Math.max(basePrice * strategyAdjustment, minPrice);

    // 6. 计算中标概率
    const winProbability = await this.calculateWinProbability(suggestedPrice, {
      budgetPrice: params.budgetPrice,
      historicalAvg: historical.statistics.avgPrice,
      competitorAvg: competitorAnalysis.avgPrice,
    });

    // 7. 生成影响因素
    const factors = this.generateFactors({
      historical,
      competitorAnalysis,
      cost,
      budgetPrice: params.budgetPrice,
    });

    // 8. 生成建议
    const recommendations = this.generateRecommendations({
      suggestedPrice,
      budgetPrice: params.budgetPrice,
      cost,
      winProbability,
      strategy: params.strategy,
    });

    return {
      suggestedPrice: Math.round(suggestedPrice),
      confidenceLevel: this.calculateConfidence(historical.quotes.length, competitorAnalysis.sampleSize),
      priceRange: {
        min: Math.round(suggestedPrice * 0.95),
        max: Math.round(suggestedPrice * 1.05),
      },
      analysis: {
        historicalAvg: historical.statistics.avgPrice,
        competitorAvg: competitorAnalysis.avgPrice,
        budgetPrice: params.budgetPrice,
        winProbabilityAt: winProbability,
      },
      factors,
      recommendations,
    };
  }

  /**
   * 估算总成本
   */
  private async estimateTotalCost(projectId: number): Promise<number> {
    const estimation = await this.costService.estimateDirectCosts(projectId);
    const cost = this.costService.calculateCost({
      directCosts: estimation.total,
      indirectRate: 0.15,
      profitMargin: 0.10,
      riskRate: 0.05,
      taxRate: 0.09,
    });
    return cost.totalCost;
  }

  /**
   * 分析竞争对手报价
   */
  private async analyzeCompetitors(_industry?: string): Promise<{
    avgPrice: number;
    sampleSize: number;
    priceDistribution: number[];
  }> {
    const quotes = await db
      .select()
      .from(bidOpeningQuotes)
      .where(eq(bidOpeningQuotes.bidderType, 'competitor'));

    const prices = quotes
      .map((q) => parseFloat(q.bidPrice || '0'))
      .filter((p) => p > 0);

    return {
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      sampleSize: prices.length,
      priceDistribution: prices,
    };
  }

  /**
   * 获取策略调整系数
   */
  private getStrategyAdjustment(strategy: 'aggressive' | 'balanced' | 'conservative'): number {
    const adjustments = {
      aggressive: 0.92, // 低8%
      balanced: 0.97, // 低3%
      conservative: 1.02, // 高2%
    };
    return adjustments[strategy];
  }

  /**
   * 计算中标概率
   */
  private async calculateWinProbability(price: number, context: {
    budgetPrice?: number;
    historicalAvg: number;
    competitorAvg: number;
  }): Promise<number> {
    let probability = 50; // 基础概率

    if (context.budgetPrice) {
      const ratio = price / context.budgetPrice;
      if (ratio < 0.85) probability += 20;
      else if (ratio < 0.95) probability += 15;
      else if (ratio < 1.0) probability += 5;
      else probability -= 10;
    }

    if (context.historicalAvg > 0) {
      if (price < context.historicalAvg) probability += 10;
      else probability -= 5;
    }

    if (context.competitorAvg > 0) {
      if (price < context.competitorAvg) probability += 10;
    }

    return Math.max(0, Math.min(100, probability));
  }

  /**
   * 生成影响因素
   */
  private generateFactors(context: any): QuoteFactor[] {
    const factors: QuoteFactor[] = [];

    if (context.budgetPrice) {
      factors.push({
        name: '预算价格',
        impact: 'positive',
        weight: 0.3,
        description: `项目预算明确，有利于精准报价`,
      });
    }

    if (context.historical.quotes.length > 10) {
      factors.push({
        name: '历史数据',
        impact: 'positive',
        weight: 0.25,
        description: `有充足的历史数据支撑`,
      });
    }

    if (context.competitorAnalysis.sampleSize > 5) {
      factors.push({
        name: '竞争分析',
        impact: 'neutral',
        weight: 0.2,
        description: `已掌握竞争对手报价规律`,
      });
    }

    return factors;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(context: any): string[] {
    const recommendations: string[] = [];

    if (context.winProbability < 50) {
      recommendations.push('建议适当降低报价以提高中标概率');
    }

    if (context.budgetPrice && context.suggestedPrice > context.budgetPrice) {
      recommendations.push('报价高于预算，需评估项目重要性');
    }

    if (context.suggestedPrice < context.cost * 1.1) {
      recommendations.push('报价接近成本线，利润空间较小');
    }

    recommendations.push('建议结合项目实际情况和公司战略综合考虑');

    return recommendations;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(historicalCount: number, competitorCount: number): 'high' | 'medium' | 'low' {
    const score = historicalCount * 0.6 + competitorCount * 0.4;
    if (score > 30) return 'high';
    if (score > 10) return 'medium';
    return 'low';
  }
}

// 导出单例
export const historicalAnalysisService = new HistoricalAnalysisService();
export const costModelService = new CostModelService();
export const quoteStrategyService = new QuoteStrategyService();

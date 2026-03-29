/**
 * 招标信息抓取服务
 * 支持多网站抓取、关键词订阅、自动匹配
 */

import { db } from '@/db';
import { projects, competitors } from '@/db/schema';
import { eq as _eq, and as _and, or, like, desc as _desc } from 'drizzle-orm';

// ============================================
// 招标信息类型定义
// ============================================

export interface TenderInfo {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  tenderCode?: string;
  tenderer?: string;
  region?: string;
  industry?: string;
  budget?: string;
  publishDate: Date;
  deadline?: Date;
  status: 'open' | 'closed' | 'cancelled';
  content?: string;
  contactPerson?: string;
  contactPhone?: string;
  keywords?: string[];
}

export interface TenderSubscription {
  id: number;
  userId: number;
  name: string;
  keywords: string[];
  regions?: string[];
  industries?: string[];
  minBudget?: number;
  maxBudget?: number;
  isActive: boolean;
  createdAt: Date;
}

// ============================================
// 招标信息源配置
// ============================================

interface TenderSource {
  name: string;
  baseUrl: string;
  listUrl: string;
  selectors: {
    list: string;
    item: string;
    title: string;
    link: string;
    date: string;
    region?: string;
    budget?: string;
  };
}

const TENDER_SOURCES: TenderSource[] = [
  {
    name: '中国政府采购网',
    baseUrl: 'http://www.ccgp.gov.cn',
    listUrl: '/search?searchtype=1&bidSort=0&buyerName=&projectId=&pinMu=0&bidType=0&dbselect=bidx&kw={keyword}',
    selectors: {
      list: '.list-ul',
      item: 'li',
      title: 'a',
      link: 'a',
      date: '.time',
    },
  },
  {
    name: '中国招标投标公共服务平台',
    baseUrl: 'http://www.cebpubservice.com',
    listUrl: '/ctpsp_iiss/searchbusinesshttpaction/ansertinterface_getsearchdata.html',
    selectors: {
      list: '.list-box',
      item: '.item',
      title: '.title a',
      link: '.title a',
      date: '.date',
    },
  },
];

// ============================================
// 招标信息抓取服务
// ============================================

export class TenderCrawlService {
  /**
   * 从指定源抓取招标信息
   */
  async crawlFromSource(source: TenderSource, keyword: string): Promise<TenderInfo[]> {
    try {
      const url = source.baseUrl + source.listUrl.replace('{keyword}', encodeURIComponent(keyword));
      
      // 实际项目中应该使用 puppeteer 或其他爬虫工具
      console.log(`[TenderCrawl] Crawling from ${source.name}: ${url}`);
      
      // TODO: 实现真实抓取逻辑
      // 这里返回模拟数据
      return this.generateMockData(source, keyword);
    } catch (error) {
      console.error(`[TenderCrawl] Error crawling ${source.name}:`, error);
      return [];
    }
  }

  /**
   * 从所有源抓取招标信息
   */
  async crawlAllSources(keyword: string): Promise<TenderInfo[]> {
    const promises = TENDER_SOURCES.map((source) => this.crawlFromSource(source, keyword));
    const results = await Promise.allSettled(promises);
    
    return results
      .filter((r): r is PromiseFulfilledResult<TenderInfo[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);
  }

  /**
   * 生成模拟数据（开发测试用）
   */
  private generateMockData(source: TenderSource, keyword: string): TenderInfo[] {
    const now = new Date();
    return [
      {
        id: `${source.name}-${Date.now()}-1`,
        source: source.name,
        sourceUrl: source.baseUrl,
        title: `【${keyword}】${source.name}招标项目示例`,
        tenderCode: `ZB${Date.now()}`,
        tenderer: '示例采购单位',
        region: '北京市',
        industry: keyword,
        budget: '500万',
        publishDate: now,
        deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'open',
        content: '本项目为示例招标项目...',
        contactPerson: '张先生',
        contactPhone: '010-12345678',
        keywords: [keyword],
      },
    ];
  }

  /**
   * 解析招标详情
   */
  async parseTenderDetail(url: string): Promise<TenderInfo | null> {
    try {
      // TODO: 实现详情页解析
      console.log(`[TenderCrawl] Parsing detail: ${url}`);
      return null;
    } catch (error) {
      console.error(`[TenderCrawl] Error parsing detail:`, error);
      return null;
    }
  }
}

// ============================================
// 招标信息订阅服务
// ============================================

export class TenderSubscriptionService {
  /**
   * 创建订阅
   */
  async createSubscription(data: {
    userId: number;
    name: string;
    keywords: string[];
    regions?: string[];
    industries?: string[];
    minBudget?: number;
    maxBudget?: number;
  }): Promise<TenderSubscription> {
    // TODO: 实现数据库存储
    return {
      id: Date.now(),
      userId: data.userId,
      name: data.name,
      keywords: data.keywords,
      regions: data.regions,
      industries: data.industries,
      minBudget: data.minBudget,
      maxBudget: data.maxBudget,
      isActive: true,
      createdAt: new Date(),
    };
  }

  /**
   * 获取用户订阅列表
   */
  async getUserSubscriptions(_userId: number): Promise<TenderSubscription[]> {
    // TODO: 实现数据库查询
    return [];
  }

  /**
   * 更新订阅
   */
  async updateSubscription(_id: number, _data: Partial<TenderSubscription>): Promise<void> {
    // TODO: 实现数据库更新
  }

  /**
   * 删除订阅
   */
  async deleteSubscription(_id: number): Promise<void> {
    // TODO: 实现数据库删除
  }

  /**
   * 检查招标信息是否匹配订阅
   */
  matchSubscription(tender: TenderInfo, subscription: TenderSubscription): boolean {
    // 关键词匹配
    const keywordMatch = subscription.keywords.some((keyword) =>
      tender.title.includes(keyword) ||
      tender.keywords?.includes(keyword)
    );
    if (!keywordMatch) return false;

    // 地区匹配
    if (subscription.regions?.length && tender.region) {
      const regionMatch = subscription.regions.some((region) =>
        tender.region?.includes(region)
      );
      if (!regionMatch) return false;
    }

    // 行业匹配
    if (subscription.industries?.length && tender.industry) {
      const industryMatch = subscription.industries.some((industry) =>
        tender.industry?.includes(industry)
      );
      if (!industryMatch) return false;
    }

    // 预算匹配
    if (tender.budget) {
      const budget = this.parseBudget(tender.budget);
      if (subscription.minBudget && budget < subscription.minBudget) return false;
      if (subscription.maxBudget && budget > subscription.maxBudget) return false;
    }

    return true;
  }

  /**
   * 解析预算字符串
   */
  private parseBudget(budgetStr: string): number {
    const match = budgetStr.match(/[\d.]+/);
    if (!match) return 0;
    
    const value = parseFloat(match[0]);
    if (budgetStr.includes('亿')) return value * 100000000;
    if (budgetStr.includes('万')) return value * 10000;
    return value;
  }
}

// ============================================
// 招标信息匹配服务
// ============================================

export class TenderMatchService {
  /**
   * 匹配项目与招标信息
   */
  async matchProject(tender: TenderInfo): Promise<{
    matchedProjects: number[];
    matchedCompetitors: number[];
    relevanceScore: number;
  }> {
    const result = {
      matchedProjects: [] as number[],
      matchedCompetitors: [] as number[],
      relevanceScore: 0,
    };

    // 查找相关项目
    const matchedProjects = await db
      .select()
      .from(projects)
      .where(
        or(
          like(projects.name, `%${tender.title.slice(0, 20)}%`),
          like(projects.tenderCode, tender.tenderCode || '')
        )
      )
      .limit(5);

    result.matchedProjects = matchedProjects.map((p) => p.id);

    // 查找相关竞争对手
    if (tender.industry) {
      const matchedCompetitors = await db
        .select()
        .from(competitors)
        .where(like(competitors.industry, `%${tender.industry}%`))
        .limit(10);

      result.matchedCompetitors = matchedCompetitors.map((c) => c.id);
    }

    // 计算相关性得分
    result.relevanceScore = this.calculateRelevanceScore(tender);

    return result;
  }

  /**
   * 计算招标信息相关性得分
   */
  private calculateRelevanceScore(tender: TenderInfo): number {
    let score = 50; // 基础分

    // 新发布加分
    const daysSincePublish = Math.floor(
      (Date.now() - new Date(tender.publishDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSincePublish <= 1) score += 30;
    else if (daysSincePublish <= 3) score += 20;
    else if (daysSincePublish <= 7) score += 10;

    // 有预算信息加分
    if (tender.budget) score += 10;

    // 有截止时间加分
    if (tender.deadline) score += 5;

    // 有联系方式加分
    if (tender.contactPhone || tender.contactPerson) score += 5;

    return Math.min(score, 100);
  }

  /**
   * 推荐招标信息
   */
  async recommendTenders(userId: number, limit: number = 10): Promise<TenderInfo[]> {
    // 获取用户订阅
    const subscriptionService = new TenderSubscriptionService();
    const subscriptions = await subscriptionService.getUserSubscriptions(userId);

    if (subscriptions.length === 0) return [];

    // 获取所有订阅关键词的招标信息
    const crawlService = new TenderCrawlService();
    const allTenders: TenderInfo[] = [];

    for (const subscription of subscriptions) {
      for (const keyword of subscription.keywords) {
        const tenders = await crawlService.crawlAllSources(keyword);
        allTenders.push(...tenders.filter((t) => subscriptionService.matchSubscription(t, subscription)));
      }
    }

    // 按相关性排序并返回
    return allTenders
      .sort((a, b) => {
        const scoreA = this.calculateRelevanceScore(a);
        const scoreB = this.calculateRelevanceScore(b);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }
}

// 导出单例
export const tenderCrawlService = new TenderCrawlService();
export const tenderSubscriptionService = new TenderSubscriptionService();
export const tenderMatchService = new TenderMatchService();

/**
 * 招标信息抓取服务
 * 提供抓取源管理、抓取任务、招标信息管理等功能
 */

import { db } from '@/db';
import {
  crawlSources,
  crawlTasks,
  tenderInfos,
  crawlKeywords,
  type CrawlSource,
  type NewCrawlSource,
  type CrawlTask,
  type NewCrawlTask,
  type TenderInfo,
  type NewTenderInfo,
  type CrawlKeyword,
  type NewCrawlKeyword,
} from '@/db/schema';
import { eq, and, desc, sql, lte, gte, inArray as _inArray, isNull as _isNull, or, like as _like, ilike } from 'drizzle-orm';
import { SearchClient } from 'coze-coding-dev-sdk';

// ============================================
// 抓取源管理
// ============================================

export async function createCrawlSource(data: NewCrawlSource): Promise<CrawlSource> {
  const [source] = await db.insert(crawlSources).values(data).returning();
  return source;
}

export async function getCrawlSources(filters?: {
  type?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ data: CrawlSource[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters?.type) {
    conditions.push(eq(crawlSources.type, filters.type as any));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(crawlSources.isActive, filters.isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(crawlSources)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(crawlSources)
    .where(whereClause)
    .orderBy(desc(crawlSources.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

export async function getCrawlSourceById(id: number): Promise<CrawlSource | null> {
  const [source] = await db
    .select()
    .from(crawlSources)
    .where(eq(crawlSources.id, id))
    .limit(1);
  return source || null;
}

export async function getCrawlSourceByCode(code: string): Promise<CrawlSource | null> {
  const [source] = await db
    .select()
    .from(crawlSources)
    .where(eq(crawlSources.code, code))
    .limit(1);
  return source || null;
}

export async function updateCrawlSource(id: number, data: Partial<NewCrawlSource>): Promise<CrawlSource> {
  const [source] = await db
    .update(crawlSources)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(crawlSources.id, id))
    .returning();
  return source;
}

export async function deleteCrawlSource(id: number): Promise<void> {
  await db.delete(crawlSources).where(eq(crawlSources.id, id));
}

// ============================================
// 抓取任务管理
// ============================================

export async function createCrawlTask(data: NewCrawlTask): Promise<CrawlTask> {
  const [task] = await db.insert(crawlTasks).values(data).returning();
  return task;
}

export async function getCrawlTasks(filters?: {
  sourceId?: number;
  status?: string;
  triggerType?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: CrawlTask[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters?.sourceId) {
    conditions.push(eq(crawlTasks.sourceId, filters.sourceId));
  }
  if (filters?.status) {
    conditions.push(eq(crawlTasks.status, filters.status as any));
  }
  if (filters?.triggerType) {
    conditions.push(eq(crawlTasks.triggerType, filters.triggerType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(crawlTasks)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select({
      task: crawlTasks,
      source: crawlSources,
    })
    .from(crawlTasks)
    .leftJoin(crawlSources, eq(crawlTasks.sourceId, crawlSources.id))
    .where(whereClause)
    .orderBy(desc(crawlTasks.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data: data.map(d => ({ ...d.task, source: d.source })),
    total,
  } as any;
}

export async function getCrawlTaskById(id: number): Promise<CrawlTask | null> {
  const [task] = await db
    .select()
    .from(crawlTasks)
    .where(eq(crawlTasks.id, id))
    .limit(1);
  return task || null;
}

export async function updateCrawlTask(id: number, data: Partial<NewCrawlTask>): Promise<CrawlTask> {
  const [task] = await db
    .update(crawlTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(crawlTasks.id, id))
    .returning();
  return task;
}

// ============================================
// 招标信息管理
// ============================================

export async function createTenderInfo(data: NewTenderInfo): Promise<TenderInfo> {
  const [info] = await db.insert(tenderInfos).values(data).returning();
  return info;
}

export async function getTenderInfos(filters?: {
  sourceId?: number;
  status?: string;
  projectId?: number;
  industry?: string;
  region?: string;
  keyword?: string;
  followedBy?: number;
  publishDateFrom?: Date;
  publishDateTo?: Date;
  submissionDeadlineFrom?: Date;
  page?: number;
  pageSize?: number;
}): Promise<{ data: TenderInfo[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters?.sourceId) {
    conditions.push(eq(tenderInfos.sourceId, filters.sourceId));
  }
  if (filters?.status) {
    conditions.push(eq(tenderInfos.status, filters.status as any));
  }
  if (filters?.projectId) {
    conditions.push(eq(tenderInfos.projectId, filters.projectId));
  }
  if (filters?.industry) {
    conditions.push(eq(tenderInfos.industry, filters.industry));
  }
  if (filters?.region) {
    conditions.push(eq(tenderInfos.region, filters.region));
  }
  if (filters?.followedBy) {
    conditions.push(eq(tenderInfos.followedBy, filters.followedBy));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        ilike(tenderInfos.title, `%${filters.keyword}%`),
        ilike(tenderInfos.tenderOrganization, `%${filters.keyword}%`),
        ilike(tenderInfos.tenderCode, `%${filters.keyword}%`)
      )
    );
  }
  if (filters?.publishDateFrom) {
    conditions.push(gte(tenderInfos.publishDate, filters.publishDateFrom));
  }
  if (filters?.publishDateTo) {
    conditions.push(lte(tenderInfos.publishDate, filters.publishDateTo));
  }
  if (filters?.submissionDeadlineFrom) {
    conditions.push(gte(tenderInfos.submissionDeadline, filters.submissionDeadlineFrom));
  }

  // 排除重复项
  conditions.push(eq(tenderInfos.isDuplicate, false));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tenderInfos)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(tenderInfos)
    .where(whereClause)
    .orderBy(desc(tenderInfos.publishDate), desc(tenderInfos.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

export async function getTenderInfoById(id: number): Promise<TenderInfo | null> {
  const [info] = await db
    .select()
    .from(tenderInfos)
    .where(eq(tenderInfos.id, id))
    .limit(1);
  return info || null;
}

export async function updateTenderInfo(id: number, data: Partial<NewTenderInfo>): Promise<TenderInfo> {
  const [info] = await db
    .update(tenderInfos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenderInfos.id, id))
    .returning();
  return info;
}

export async function deleteTenderInfo(id: number): Promise<void> {
  await db.delete(tenderInfos).where(eq(tenderInfos.id, id));
}

// ============================================
// 关注/忽略操作
// ============================================

export async function followTenderInfo(id: number, userId: number): Promise<TenderInfo> {
  return updateTenderInfo(id, {
    status: 'following',
    followedBy: userId,
    followedAt: new Date(),
  });
}

export async function unfollowTenderInfo(id: number): Promise<TenderInfo> {
  return updateTenderInfo(id, {
    status: 'new',
    followedBy: null,
    followedAt: null,
  });
}

export async function ignoreTenderInfo(id: number): Promise<TenderInfo> {
  return updateTenderInfo(id, {
    status: 'ignored',
  });
}

// ============================================
// 关键词管理
// ============================================

export async function createCrawlKeyword(data: NewCrawlKeyword): Promise<CrawlKeyword> {
  const [keyword] = await db.insert(crawlKeywords).values(data).returning();
  return keyword;
}

export async function getCrawlKeywords(filters?: {
  category?: string;
  isActive?: boolean;
}): Promise<CrawlKeyword[]> {
  const conditions = [];
  if (filters?.category) {
    conditions.push(eq(crawlKeywords.category, filters.category));
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(crawlKeywords.isActive, filters.isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select()
    .from(crawlKeywords)
    .where(whereClause)
    .orderBy(desc(crawlKeywords.priority), desc(crawlKeywords.createdAt));
}

export async function deleteCrawlKeyword(id: number): Promise<void> {
  await db.delete(crawlKeywords).where(eq(crawlKeywords.id, id));
}

// ============================================
// Web搜索抓取
// ============================================

/**
 * 使用Web搜索抓取招标信息
 */
export async function crawlTenderInfoFromWeb(query: string, options?: {
  maxResults?: number;
  sourceId?: number;
}): Promise<TenderInfo[]> {
  try {
    const { Config } = await import('coze-coding-dev-sdk');
    const config = new Config();
    const searchClient = new SearchClient(config);
    
    const results = await searchClient.webSearch(query, options?.maxResults || 10);

    const tenderItems: TenderInfo[] = [];
    
    for (const result of results.web_items || []) {
      // 跳过没有 URL 的结果
      if (!result.url) continue;
      
      // 检查是否已存在
      const existing = await db
        .select()
        .from(tenderInfos)
        .where(eq(tenderInfos.sourceUrl, result.url))
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      // 创建新的招标信息
      const tenderData: NewTenderInfo = {
        title: result.title || '未命名招标',
        sourceUrl: result.url,
        summary: result.snippet,
        content: result.content,
        sourceId: options?.sourceId || null,
        status: 'new',
        contentHash: generateContentHash(result.url || ''),
        createdBy: null,
      };

      const tender = await createTenderInfo(tenderData);
      tenderItems.push(tender);
    }

    return tenderItems;
  } catch (error) {
    console.error('Web搜索抓取失败:', error);
    throw error;
  }
}

/**
 * 智能搜索招标信息
 */
export async function smartSearchTenderInfo(params: {
  keywords?: string[];
  industry?: string;
  region?: string;
  maxResults?: number;
}): Promise<TenderInfo[]> {
  const { keywords = [], industry, region, maxResults = 20 } = params;
  
  // 构建搜索查询
  const queryParts = [...keywords];
  if (industry) queryParts.push(industry);
  if (region) queryParts.push(region);
  queryParts.push('招标');
  
  const query = queryParts.join(' ');
  
  return crawlTenderInfoFromWeb(query, { maxResults });
}

// ============================================
// 统计分析
// ============================================

export async function getTenderInfoStatistics(filters?: {
  sourceId?: number;
}): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byIndustry: Record<string, number>;
  byRegion: Record<string, number>;
  upcomingDeadlines: number;
}> {
  const conditions = [];
  if (filters?.sourceId) {
    conditions.push(eq(tenderInfos.sourceId, filters.sourceId));
  }
  conditions.push(eq(tenderInfos.isDuplicate, false));

  const items = await db
    .select()
    .from(tenderInfos)
    .where(and(...conditions));

  const now = new Date();
  const stats = {
    total: items.length,
    byStatus: {} as Record<string, number>,
    byIndustry: {} as Record<string, number>,
    byRegion: {} as Record<string, number>,
    upcomingDeadlines: 0,
  };

  for (const item of items) {
    stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
    if (item.industry) {
      stats.byIndustry[item.industry] = (stats.byIndustry[item.industry] || 0) + 1;
    }
    if (item.region) {
      stats.byRegion[item.region] = (stats.byRegion[item.region] || 0) + 1;
    }
    if (item.submissionDeadline && new Date(item.submissionDeadline) > now) {
      stats.upcomingDeadlines++;
    }
  }

  return stats;
}

// ============================================
// 辅助函数
// ============================================

function generateContentHash(content: string): string {
  // 简单哈希生成（实际应用中应使用加密哈希）
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

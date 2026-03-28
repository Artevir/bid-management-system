/**
 * 开标记录管理服务
 * 提供开标记录、报价对比、分析报告等功能
 */

import { db } from '@/db';
import {
  bidOpenings,
  bidOpeningQuotes,
  competitors,
  projects,
  users,
  type BidOpening,
  type NewBidOpening,
  type BidOpeningQuote,
  type NewBidOpeningQuote,
} from '@/db/schema';
import { eq, and, desc, sql, inArray, gte, lte } from 'drizzle-orm';

// ============================================
// 开标记录管理
// ============================================

export async function createOpening(data: NewBidOpening): Promise<BidOpening> {
  const [opening] = await db.insert(bidOpenings).values(data).returning();
  return opening;
}

export async function getOpenings(filters?: {
  projectId?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: BidOpening[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(bidOpenings.projectId, filters.projectId));
  }
  if (filters?.status) {
    conditions.push(eq(bidOpenings.status, filters.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bidOpenings)
    .where(whereClause);

  const total = Number(count);

  const data = await db
    .select()
    .from(bidOpenings)
    .where(whereClause)
    .orderBy(desc(bidOpenings.openingDate))
    .limit(pageSize)
    .offset(offset);

  return { data, total };
}

export async function getOpeningById(id: number): Promise<BidOpening | null> {
  const [opening] = await db
    .select()
    .from(bidOpenings)
    .where(eq(bidOpenings.id, id))
    .limit(1);
  return opening || null;
}

export async function updateOpening(id: number, data: Partial<NewBidOpening>): Promise<BidOpening> {
  const [opening] = await db
    .update(bidOpenings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(bidOpenings.id, id))
    .returning();
  return opening;
}

export async function deleteOpening(id: number): Promise<void> {
  // 先删除相关报价记录
  await db.delete(bidOpeningQuotes).where(eq(bidOpeningQuotes.openingId, id));
  await db.delete(bidOpenings).where(eq(bidOpenings.id, id));
}

// ============================================
// 报价对比管理
// ============================================

export async function addOpeningQuote(data: NewBidOpeningQuote): Promise<BidOpeningQuote> {
  const [quote] = await db.insert(bidOpeningQuotes).values(data).returning();
  
  // 如果标记为中标者，更新开标记录
  if (data.isWinner) {
    await db
      .update(bidOpenings)
      .set({
        winnerName: data.bidderName,
        winnerPrice: data.bidPrice,
        status: 'opened',
        updatedAt: new Date(),
      })
      .where(eq(bidOpenings.id, data.openingId));
  }
  
  return quote;
}

export async function getOpeningQuoteById(id: number): Promise<BidOpeningQuote | null> {
  const [quote] = await db
    .select()
    .from(bidOpeningQuotes)
    .where(eq(bidOpeningQuotes.id, id))
    .limit(1);
  return quote || null;
}

export async function getOpeningQuotes(openingId: number): Promise<BidOpeningQuote[]> {
  return db
    .select()
    .from(bidOpeningQuotes)
    .where(eq(bidOpeningQuotes.openingId, openingId))
    .orderBy(bidOpeningQuotes.rank);
}

export async function updateOpeningQuote(id: number, data: Partial<NewBidOpeningQuote>): Promise<BidOpeningQuote> {
  const [quote] = await db
    .update(bidOpeningQuotes)
    .set(data)
    .where(eq(bidOpeningQuotes.id, id))
    .returning();
  return quote;
}

export async function deleteOpeningQuote(id: number): Promise<void> {
  await db.delete(bidOpeningQuotes).where(eq(bidOpeningQuotes.id, id));
}

// ============================================
// 批量操作
// ============================================

export async function batchAddOpeningQuotes(
  openingId: number,
  quotes: Omit<NewBidOpeningQuote, 'openingId'>[]
): Promise<BidOpeningQuote[]> {
  const data = quotes.map((q) => ({ ...q, openingId }));
  const result = await db.insert(bidOpeningQuotes).values(data).returning();
  return result;
}

export async function updateQuoteRanks(openingId: number, rankings: { id: number; rank: number }[]): Promise<void> {
  for (const r of rankings) {
    await db
      .update(bidOpeningQuotes)
      .set({ rank: r.rank })
      .where(eq(bidOpeningQuotes.id, r.id));
  }
}

// ============================================
// 分析统计
// ============================================

export async function getOpeningStatistics(projectId?: number): Promise<{
  total: number;
  byStatus: Record<string, number>;
  winCount: number;
  loseCount: number;
  winRate: number;
  avgPriceGap: number;
}> {
  const conditions = projectId ? [eq(bidOpenings.projectId, projectId)] : [];

  const openings = await db
    .select()
    .from(bidOpenings)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const stats = {
    total: openings.length,
    byStatus: {} as Record<string, number>,
    winCount: 0,
    loseCount: 0,
    winRate: 0,
    avgPriceGap: 0,
  };

  for (const o of openings) {
    stats.byStatus[o.status] = (stats.byStatus[o.status] || 0) + 1;
  }

  // 统计中标情况
  const quotes = await db
    .select()
    .from(bidOpeningQuotes)
    .where(eq(bidOpeningQuotes.bidderType, 'us'));

  for (const q of quotes) {
    if (q.isWinner) {
      stats.winCount++;
    } else {
      stats.loseCount++;
    }
  }

  const totalBids = stats.winCount + stats.loseCount;
  if (totalBids > 0) {
    stats.winRate = Math.round((stats.winCount / totalBids) * 100);
  }

  return stats;
}

export async function getCompetitorWinRate(): Promise<{
  competitorId: number;
  competitorName: string;
  totalBids: number;
  wins: number;
  winRate: number;
}[]> {
  // 获取所有关联竞争对手的报价记录
  const quotes = await db
    .select({
      competitorId: bidOpeningQuotes.competitorId,
      isWinner: bidOpeningQuotes.isWinner,
    })
    .from(bidOpeningQuotes)
    .where(sql`${bidOpeningQuotes.competitorId} IS NOT NULL`);

  // 统计每个竞争对手的数据
  const stats = new Map<number, { totalBids: number; wins: number }>();

  for (const q of quotes) {
    if (!q.competitorId) continue;
    const stat = stats.get(q.competitorId) || { totalBids: 0, wins: 0 };
    stat.totalBids++;
    if (q.isWinner) stat.wins++;
    stats.set(q.competitorId, stat);
  }

  // 获取竞争对手名称
  const competitorIds = Array.from(stats.keys());
  if (competitorIds.length === 0) return [];

  const competitorList = await db
    .select()
    .from(competitors)
    .where(inArray(competitors.id, competitorIds));

  return competitorList.map((c) => {
    const stat = stats.get(c.id) || { totalBids: 0, wins: 0 };
    return {
      competitorId: c.id,
      competitorName: c.name,
      totalBids: stat.totalBids,
      wins: stat.wins,
      winRate: stat.totalBids > 0 ? Math.round((stat.wins / stat.totalBids) * 100) : 0,
    };
  }).sort((a, b) => b.winRate - a.winRate);
}

// ============================================
// 即将开标提醒
// ============================================

export async function getUpcomingOpenings(days: number = 7): Promise<BidOpening[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  return db
    .select()
    .from(bidOpenings)
    .where(
      and(
        eq(bidOpenings.status, 'pending'),
        gte(bidOpenings.openingDate, today),
        lte(bidOpenings.openingDate, futureDate)
      )
    )
    .orderBy(bidOpenings.openingDate);
}

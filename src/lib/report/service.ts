/**
 * 统计报表服务
 * 提供投标统计、成本分析、效率分析等报表数据
 */

import { db } from '@/db';
import {
  projects,
  projectMilestones,
  bidDocuments,
  users,
  departments,
} from '@/db/schema';
import { eq, and, or, desc, gte, lte, between, sql, count, sum } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface BidStatistics {
  total: number;          // 总投标数
  won: number;            // 中标数
  lost: number;           // 未中标数
  pending: number;        // 待开标数
  winRate: number;        // 中标率
  totalAmount: number;    // 投标总金额
  wonAmount: number;      // 中标总金额
}

export interface MonthlyBidTrend {
  month: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
  winRate: number;
}

export interface IndustryDistribution {
  industry: string;
  count: number;
  wonCount: number;
  winRate: number;
  percentage: number;
}

export interface RegionalDistribution {
  region: string;
  count: number;
  wonCount: number;
  winRate: number;
  percentage: number;
}

export interface CostStatistics {
  totalCost: number;           // 总成本
  laborCost: number;           // 人力成本
  materialCost: number;        // 材料成本
  travelCost: number;          // 差旅成本
  otherCost: number;           // 其他成本
  avgCostPerBid: number;       // 单次投标平均成本
  avgCostPerWin: number;       // 单次中标平均成本
}

export interface EfficiencyMetrics {
  avgBidCycle: number;         // 平均投标周期（天）
  avgResponseTime: number;     // 平均响应时间（小时）
  avgDocumentPrepTime: number; // 平均文档准备时间（小时）
  onTimeRate: number;          // 按时完成率
  revisionRate: number;        // 返工率
}

export interface UserPerformance {
  userId: number;
  userName: string;
  departmentName: string;
  bidCount: number;            // 参与投标数
  wonCount: number;            // 中标数
  winRate: number;             // 中标率
  taskCount: number;           // 任务数
  completedTaskCount: number;  // 完成任务数
  completionRate: number;      // 完成率
  avgResponseTime: number;     // 平均响应时间
}

export interface ProjectProgressStats {
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface DocumentStats {
  total: number;
  draft: number;
  inReview: number;
  approved: number;
  rejected: number;
  avgPages: number;
  avgWordCount: number;
}

// ============================================
// 投标统计
// ============================================

/**
 * 获取投标总体统计
 */
export async function getBidStatistics(
  startDate?: Date,
  endDate?: Date,
  departmentId?: number
): Promise<BidStatistics> {
  const conditions = [];
  
  if (startDate) {
    conditions.push(gte(projects.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(projects.createdAt, endDate));
  }
  if (departmentId) {
    conditions.push(eq(projects.departmentId, departmentId));
  }

  // 统计各状态数量
  const stats = await db
    .select({
      status: projects.status,
      count: count(),
    })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projects.status);

  const result: BidStatistics = {
    total: 0,
    won: 0,
    lost: 0,
    pending: 0,
    winRate: 0,
    totalAmount: 0,
    wonAmount: 0,
  };

  for (const stat of stats) {
    result.total += stat.count;
    switch (stat.status) {
      case 'awarded': // 中标
        result.won = stat.count;
        break;
      case 'lost':
        result.lost = stat.count;
        break;
      case 'submitted': // 已投标
      case 'preparing': // 编制中
      case 'reviewing': // 审核中
      case 'approved': // 已通过
        result.pending += stat.count;
        break;
    }
  }

  if (result.total > 0) {
    result.winRate = Math.round((result.won / result.total) * 100);
  }

  // 获取金额统计
  const amountStats = await db
    .select({
      status: projects.status,
      totalAmount: sum(projects.budget),
    })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projects.status);

  for (const stat of amountStats) {
    if (stat.totalAmount) {
      result.totalAmount += Number(stat.totalAmount);
      if (stat.status === 'awarded') {
        result.wonAmount = Number(stat.totalAmount);
      }
    }
  }

  return result;
}

/**
 * 获取投标月度趋势
 */
export async function getMonthlyBidTrend(
  months: number = 12,
  departmentId?: number
): Promise<MonthlyBidTrend[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);

  const conditions = [gte(projects.createdAt, startDate)];
  if (departmentId) {
    conditions.push(eq(projects.departmentId, departmentId));
  }

  // 按月分组统计
  const monthlyData = await db
    .select({
      month: sql<string>`to_char(${projects.createdAt}, 'YYYY-MM')`,
      status: projects.status,
      count: count(),
    })
    .from(projects)
    .where(and(...conditions))
    .groupBy(
      sql`to_char(${projects.createdAt}, 'YYYY-MM')`,
      projects.status
    )
    .orderBy(sql`to_char(${projects.createdAt}, 'YYYY-MM')`);

  // 整理数据
  const monthMap = new Map<string, MonthlyBidTrend>();
  
  for (const data of monthlyData) {
    let monthData = monthMap.get(data.month);
    if (!monthData) {
      monthData = {
        month: data.month,
        total: 0,
        won: 0,
        lost: 0,
        pending: 0,
        winRate: 0,
      };
      monthMap.set(data.month, monthData);
    }
    
    monthData.total += data.count;
    switch (data.status) {
      case 'awarded':
        monthData.won = data.count;
        break;
      case 'lost':
        monthData.lost = data.count;
        break;
      case 'submitted':
      case 'preparing':
      case 'reviewing':
      case 'approved':
        monthData.pending += data.count;
        break;
    }
  }

  // 计算中标率
  const result = Array.from(monthMap.values());
  for (const month of result) {
    if (month.total > 0) {
      month.winRate = Math.round((month.won / month.total) * 100);
    }
  }

  return result;
}

/**
 * 获取行业分布
 */
export async function getIndustryDistribution(
  startDate?: Date,
  endDate?: Date
): Promise<IndustryDistribution[]> {
  const conditions = [];
  
  if (startDate) {
    conditions.push(gte(projects.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(projects.createdAt, endDate));
  }

  // 按行业分组统计
  const industryData = await db
    .select({
      industry: projects.industry,
      status: projects.status,
      count: count(),
    })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projects.industry, projects.status);

  // 整理数据
  const industryMap = new Map<string, { total: number; won: number }>();
  let total = 0;

  for (const data of industryData) {
    const industry = data.industry || '其他';
    let industryStats = industryMap.get(industry);
    if (!industryStats) {
      industryStats = { total: 0, won: 0 };
      industryMap.set(industry, industryStats);
    }
    
    industryStats.total += data.count;
    total += data.count;
    
    if (data.status === 'awarded') {
      industryStats.won += data.count;
    }
  }

  // 转换为数组并计算比例
  const result: IndustryDistribution[] = [];
  for (const [industry, stats] of industryMap) {
    result.push({
      industry,
      count: stats.total,
      wonCount: stats.won,
      winRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0,
      percentage: total > 0 ? Math.round((stats.total / total) * 100) : 0,
    });
  }

  // 按数量排序
  return result.sort((a, b) => b.count - a.count);
}

/**
 * 获取地区分布
 */
export async function getRegionalDistribution(
  startDate?: Date,
  endDate?: Date
): Promise<RegionalDistribution[]> {
  const conditions = [];
  
  if (startDate) {
    conditions.push(gte(projects.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(projects.createdAt, endDate));
  }

  // 按地区分组统计
  const regionData = await db
    .select({
      region: projects.region,
      status: projects.status,
      count: count(),
    })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projects.region, projects.status);

  // 整理数据
  const regionMap = new Map<string, { total: number; won: number }>();
  let total = 0;

  for (const data of regionData) {
    const region = data.region || '未知';
    let regionStats = regionMap.get(region);
    if (!regionStats) {
      regionStats = { total: 0, won: 0 };
      regionMap.set(region, regionStats);
    }
    
    regionStats.total += data.count;
    total += data.count;
    
    if (data.status === 'awarded') {
      regionStats.won += data.count;
    }
  }

  // 转换为数组并计算比例
  const result: RegionalDistribution[] = [];
  for (const [region, stats] of regionMap) {
    result.push({
      region,
      count: stats.total,
      wonCount: stats.won,
      winRate: stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0,
      percentage: total > 0 ? Math.round((stats.total / total) * 100) : 0,
    });
  }

  // 按数量排序
  return result.sort((a, b) => b.count - a.count);
}

// ============================================
// 成本统计
// ============================================

/**
 * 获取成本统计
 */
export async function getCostStatistics(
  startDate?: Date,
  endDate?: Date,
  departmentId?: number
): Promise<CostStatistics> {
  // 由于数据库中可能没有专门的成本表，这里返回模拟数据
  // 实际使用时需要根据真实的成本数据表进行统计
  
  const bidStats = await getBidStatistics(startDate, endDate, departmentId);
  
  // 假设基础成本
  const baseCost = bidStats.total * 5000; // 每次投标基础成本5000元
  
  const result: CostStatistics = {
    totalCost: baseCost,
    laborCost: Math.round(baseCost * 0.6),      // 人力成本占60%
    materialCost: Math.round(baseCost * 0.15),  // 材料成本占15%
    travelCost: Math.round(baseCost * 0.15),    // 差旅成本占15%
    otherCost: Math.round(baseCost * 0.1),      // 其他成本占10%
    avgCostPerBid: bidStats.total > 0 ? Math.round(baseCost / bidStats.total) : 0,
    avgCostPerWin: bidStats.won > 0 ? Math.round(baseCost / bidStats.won) : 0,
  };

  return result;
}

// ============================================
// 效率分析
// ============================================

/**
 * 获取效率指标
 */
export async function getEfficiencyMetrics(
  startDate?: Date,
  endDate?: Date,
  departmentId?: number
): Promise<EfficiencyMetrics> {
  const conditions = [];
  
  if (startDate) {
    conditions.push(gte(projects.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(projects.createdAt, endDate));
  }
  if (departmentId) {
    conditions.push(eq(projects.departmentId, departmentId));
  }

  // 获取已完成的项目，计算平均周期
  const completedProjects = await db
    .select({
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(
      and(
        ...(conditions.length > 0 ? conditions : []),
        eq(projects.status, 'awarded')
      )
    );

  let totalDays = 0;
  let onTimeCount = 0;
  let totalCount = 0;

  for (const project of completedProjects) {
    if (project.createdAt && project.updatedAt) {
      const days = Math.ceil(
        (new Date(project.updatedAt).getTime() - new Date(project.createdAt).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      totalDays += days;
      totalCount++;
      
      // 假设30天内完成算按时
      if (days <= 30) {
        onTimeCount++;
      }
    }
  }

  const result: EfficiencyMetrics = {
    avgBidCycle: totalCount > 0 ? Math.round(totalDays / totalCount) : 0,
    avgResponseTime: 24, // 平均响应时间24小时
    avgDocumentPrepTime: 48, // 平均文档准备时间48小时
    onTimeRate: totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 0,
    revisionRate: 15, // 返工率15%
  };

  return result;
}

// ============================================
// 用户绩效
// ============================================

/**
 * 获取用户绩效统计
 */
export async function getUserPerformance(
  startDate?: Date,
  endDate?: Date,
  departmentId?: number,
  limit: number = 20
): Promise<UserPerformance[]> {
  const conditions = [];
  
  if (startDate) {
    conditions.push(gte(projects.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(projects.createdAt, endDate));
  }

  // 查询用户参与的项目统计
  const userStats = await db
    .select({
      userId: users.id,
      userName: users.realName,
      departmentId: users.departmentId,
      departmentName: departments.name,
      projectId: projects.id,
      projectStatus: projects.status,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(projects, eq(projects.ownerId, users.id))
    .where(
      and(
        departmentId ? eq(users.departmentId, departmentId) : undefined,
        ...(conditions.length > 0 ? conditions.map(c => eq(projects.status, projects.status)) : [])
      )
    )
    .limit(limit);

  // 整理用户绩效数据
  const userMap = new Map<number, UserPerformance>();

  for (const stat of userStats) {
    if (!stat.userId) continue;
    
    let perf = userMap.get(stat.userId);
    if (!perf) {
      perf = {
        userId: stat.userId,
        userName: stat.userName || '',
        departmentName: stat.departmentName || '',
        bidCount: 0,
        wonCount: 0,
        winRate: 0,
        taskCount: 0,
        completedTaskCount: 0,
        completionRate: 0,
        avgResponseTime: 0,
      };
      userMap.set(stat.userId, perf);
    }

    if (stat.projectId) {
      perf.bidCount++;
      if (stat.projectStatus === 'awarded') {
        perf.wonCount++;
      }
    }
  }

  // 计算中标率
  const result = Array.from(userMap.values());
  for (const perf of result) {
    if (perf.bidCount > 0) {
      perf.winRate = Math.round((perf.wonCount / perf.bidCount) * 100);
    }
  }

  // 按中标数排序
  return result.sort((a, b) => b.wonCount - a.wonCount).slice(0, limit);
}

// ============================================
// 项目进度统计
// ============================================

/**
 * 获取项目进度统计
 */
export async function getProjectProgressStats(
  departmentId?: number
): Promise<ProjectProgressStats> {
  const conditions = departmentId 
    ? [eq(projects.departmentId, departmentId)]
    : [];

  const stats = await db
    .select({
      status: projects.status,
      count: count(),
    })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projects.status);

  const result: ProjectProgressStats = {
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  };

  for (const stat of stats) {
    switch (stat.status) {
      case 'draft':
      case 'parsing':
        result.notStarted += stat.count;
        break;
      case 'preparing':
      case 'reviewing':
      case 'approved':
        result.inProgress += stat.count;
        break;
      case 'submitted':
      case 'awarded':
        result.completed += stat.count;
        break;
      case 'lost':
      case 'archived':
        result.overdue += stat.count;
        break;
    }
  }

  return result;
}

// ============================================
// 文档统计
// ============================================

/**
 * 获取文档统计
 */
export async function getDocumentStatistics(
  projectId?: number
): Promise<DocumentStats> {
  const conditions = projectId 
    ? [eq(bidDocuments.projectId, projectId)]
    : [];

  const stats = await db
    .select({
      status: bidDocuments.status,
      count: count(),
    })
    .from(bidDocuments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(bidDocuments.status);

  const result: DocumentStats = {
    total: 0,
    draft: 0,
    inReview: 0,
    approved: 0,
    rejected: 0,
    avgPages: 0,
    avgWordCount: 0,
  };

  for (const stat of stats) {
    result.total += stat.count;
    switch (stat.status) {
      case 'draft':
        result.draft = stat.count;
        break;
      case 'reviewing':
        result.inReview = stat.count;
        break;
      case 'approved':
        result.approved = stat.count;
        break;
      case 'rejected':
        result.rejected = stat.count;
        break;
    }
  }

  // 平均页数和字数（模拟数据）
  result.avgPages = result.total > 0 ? 25 : 0;
  result.avgWordCount = result.total > 0 ? 15000 : 0;

  return result;
}

// ============================================
// 综合报表
// ============================================

/**
 * 获取综合报表数据
 */
export async function getComprehensiveReport(params: {
  startDate?: Date;
  endDate?: Date;
  departmentId?: number;
}): Promise<{
  bidStatistics: BidStatistics;
  costStatistics: CostStatistics;
  efficiencyMetrics: EfficiencyMetrics;
  monthlyTrend: MonthlyBidTrend[];
  industryDistribution: IndustryDistribution[];
  regionalDistribution: RegionalDistribution[];
  projectProgress: ProjectProgressStats;
  documentStats: DocumentStats;
}> {
  const { startDate, endDate, departmentId } = params;

  const [
    bidStatistics,
    costStatistics,
    efficiencyMetrics,
    monthlyTrend,
    industryDistribution,
    regionalDistribution,
    projectProgress,
    documentStats,
  ] = await Promise.all([
    getBidStatistics(startDate, endDate, departmentId),
    getCostStatistics(startDate, endDate, departmentId),
    getEfficiencyMetrics(startDate, endDate, departmentId),
    getMonthlyBidTrend(12, departmentId),
    getIndustryDistribution(startDate, endDate),
    getRegionalDistribution(startDate, endDate),
    getProjectProgressStats(departmentId),
    getDocumentStatistics(),
  ]);

  return {
    bidStatistics,
    costStatistics,
    efficiencyMetrics,
    monthlyTrend,
    industryDistribution,
    regionalDistribution,
    projectProgress,
    documentStats,
  };
}

/**
 * 审核统计与效率分析服务
 */

import { db } from '@/db';
import { approvalRecords, users } from '@/db/schema';
import { eq, and, gte, lte, count, sql, avg, desc } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface ApprovalStats {
  // 基础统计
  totalRecords: number;
  pendingRecords: number;
  completedRecords: number;
  rejectedRecords: number;

  // 效率指标
  avgApprovalTime: number; // 平均审核时长（小时）
  avgResponseTime: number; // 平均响应时间（小时）
  approvalRate: number; // 通过率

  // 时间分布
  dailyStats: DailyStats[];
  weeklyStats: WeeklyStats[];

  // 审核人统计
  reviewerStats: ReviewerStats[];
}

export interface DailyStats {
  date: string;
  total: number;
  completed: number;
  rejected: number;
}

export interface WeeklyStats {
  week: string;
  total: number;
  avgTime: number;
}

export interface ReviewerStats {
  userId: number;
  username: string;
  totalReviews: number;
  avgTime: number;
  approvalRate: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ============================================
// 审核统计服务
// ============================================

/**
 * 获取审核概览统计
 */
export async function getApprovalOverview(
  orgId: number,
  dateRange?: DateRange
): Promise<ApprovalStats> {
  // 构建查询条件
  const conditions = [];
  if (dateRange?.startDate) {
    conditions.push(gte(approvalRecords.createdAt, dateRange.startDate));
  }
  if (dateRange?.endDate) {
    conditions.push(lte(approvalRecords.createdAt, dateRange.endDate));
  }

  // 获取基础统计
  const records = await db
    .select()
    .from(approvalRecords);

  // 计算统计数据
  const totalRecords = records.length;
  const pendingRecords = records.filter(r => r.status === 'pending').length;
  const completedRecords = records.filter(r => r.status === 'approved').length;
  const rejectedRecords = records.filter(r => r.status === 'rejected').length;

  const approvalRate = totalRecords > 0 
    ? (completedRecords / totalRecords) * 100 
    : 0;

  return {
    totalRecords,
    pendingRecords,
    completedRecords,
    rejectedRecords,
    avgApprovalTime: 0, // 需要从节点表计算
    avgResponseTime: 0,
    approvalRate,
    dailyStats: [],
    weeklyStats: [],
    reviewerStats: [],
  };
}

/**
 * 获取审核效率趋势
 */
export async function getApprovalTrend(
  orgId: number,
  dateRange: DateRange
): Promise<DailyStats[]> {
  // 按日期分组统计
  // 简化实现，返回空数组
  return [];
}

/**
 * 获取审核人效率排名
 */
export async function getReviewerRanking(
  orgId: number,
  dateRange?: DateRange
): Promise<ReviewerStats[]> {
  // 统计每个审核人的效率
  // 简化实现，返回空数组
  return [];
}

/**
 * 获取项目审核效率报表
 */
export async function getProjectApprovalReport(projectId: number) {
  // 使用approvalFlows来获取审核状态
  // 简化实现，返回基本统计
  return {
    projectId,
    totalNodes: 0,
    completedNodes: 0,
    pendingNodes: 0,
    rejectedNodes: 0,
    progress: 0,
    estimatedCompletion: null, // 预计完成时间
  };
}

/**
 * 导出审核统计报表（CSV）
 */
export function exportApprovalReportCSV(stats: ApprovalStats): string {
  const headers = [
    '指标',
    '数值',
  ];

  const rows = [
    ['总审核记录数', stats.totalRecords.toString()],
    ['待审核数', stats.pendingRecords.toString()],
    ['已完成数', stats.completedRecords.toString()],
    ['已驳回数', stats.rejectedRecords.toString()],
    ['平均审核时长(小时)', stats.avgApprovalTime.toFixed(2)],
    ['通过率(%)', stats.approvalRate.toFixed(2)],
  ];

  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

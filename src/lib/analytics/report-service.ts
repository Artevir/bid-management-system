/**
 * 报表统计分析服务
 * 支持各种业务报表的生成和可视化
 */

import { db } from '@/db/index';
import { projects, bidDocuments } from '@/db/schema';
import { sql, eq as _eq, and, gte, lte, desc as _desc, count } from 'drizzle-orm';

// ============================================
// 报表类型
// ============================================

export enum ReportType {
  PROJECT_STATISTICS = 'project_statistics',
  DOCUMENT_STATISTICS = 'document_statistics',
  BID_RATE_ANALYSIS = 'bid_rate_analysis',
  REVIEW_EFFICIENCY = 'review_efficiency',
  USER_WORKLOAD = 'user_workload',
  DEPARTMENT_PERFORMANCE = 'department_performance',
  FINANCE_STATISTICS = 'finance_statistics',
}

// ============================================
// 统计数据接口
// ============================================

export interface StatisticsData {
  total: number;
  growth?: number; // 同比增长率
  breakdown?: Record<string, number>; // 按维度分解
  trend?: Array<{ date: string; value: number }>; // 趋势数据
}

// ============================================
// 报表服务类
// ============================================

export class ReportService {
  /**
   * 项目统计报表
   */
  static async getProjectStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: StatisticsData;
    byStatus: Record<string, number>;
    byCompany: Record<string, number>;
    trend: Array<{ date: string; value: number }>;
  }> {
    const conditions = [];

    if (startDate) {
      conditions.push(gte(projects.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(projects.createdAt, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 总项目数
    const totalResult = await db
      .select({ count: count() })
      .from(projects)
      .where(whereClause);

    const total = Number(totalResult[0]?.count || 0);

    // 按状态统计
    const statusResult = await db
      .select({
        status: projects.status,
        count: count(),
      })
      .from(projects)
      .where(whereClause)
      .groupBy(projects.status);

    const byStatus: Record<string, number> = {};
    for (const row of statusResult) {
      byStatus[row.status] = Number(row.count);
    }

    // 按公司统计
    const companyResult = await db
      .select({
        companyId: projects.platformId,
        count: count(),
      })
      .from(projects)
      .where(whereClause)
      .groupBy(projects.platformId);

    const byCompany: Record<string, number> = {};
    for (const row of companyResult) {
      byCompany[String(row.companyId ?? 'unknown')] = Number(row.count);
    }

    // 趋势数据（按月）
    const trendResult = await db
      .select({
        date: sql<string>`DATE_TRUNC('month', created_at)::text`,
        count: count(),
      })
      .from(projects)
      .where(whereClause)
      .groupBy(sql`DATE_TRUNC('month', created_at)`)
      .orderBy(sql`DATE_TRUNC('month', created_at)`);

    const trend = trendResult.map(row => ({
      date: row.date,
      value: Number(row.count),
    }));

    return {
      total: { total },
      byStatus,
      byCompany,
      trend,
    };
  }

  /**
   * 文档统计报表
   */
  static async getDocumentStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: StatisticsData;
    byType: Record<string, number>;
    byProject: Record<string, number>;
    totalSize: number;
  }> {
    const conditions = [];

    if (startDate) {
      conditions.push(gte(bidDocuments.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(bidDocuments.createdAt, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 总文档数
    const totalResult = await db
      .select({ count: count() })
      .from(bidDocuments)
      .where(whereClause);

    const total = Number(totalResult[0]?.count || 0);

    // 按状态统计（原 documents.type 不存在，使用标书状态作为维度）
    const typeResult = await db
      .select({
        type: bidDocuments.status,
        count: count(),
      })
      .from(bidDocuments)
      .where(whereClause)
      .groupBy(bidDocuments.status);

    const byType: Record<string, number> = {};
    for (const row of typeResult) {
      byType[row.type || 'unknown'] = Number(row.count);
    }

    // 按项目统计
    const projectResult = await db
      .select({
        projectId: bidDocuments.projectId,
        count: count(),
      })
      .from(bidDocuments)
      .where(whereClause)
      .groupBy(bidDocuments.projectId);

    const byProject: Record<string, number> = {};
    for (const row of projectResult) {
      byProject[row.projectId || 'unknown'] = Number(row.count);
    }

    // 总规模（原 documents.file_size 不存在，使用 wordCount 汇总作为规模指标）
    const sizeResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bidDocuments.wordCount}), 0)`,
      })
      .from(bidDocuments)
      .where(whereClause);

    const totalSize = Number(sizeResult[0]?.total || 0);

    return {
      total: { total },
      byType,
      byProject,
      totalSize,
    };
  }

  /**
   * 中标率分析
   */
  static async getBidRateAnalysis(
    _startDate?: Date,
    _endDate?: Date
  ): Promise<{
    totalProjects: number;
    wonProjects: number;
    lostProjects: number;
    winRate: number;
    byCompany: Record<string, { total: number; won: number; winRate: number }>;
  }> {
    // TODO: 实现中标率分析
    // 需要从项目中统计中标和未中标的数量
    return {
      totalProjects: 0,
      wonProjects: 0,
      lostProjects: 0,
      winRate: 0,
      byCompany: {},
    };
  }

  /**
   * 审核效率分析
   */
  static async getReviewEfficiency(
    _startDate?: Date,
    _endDate?: Date
  ): Promise<{
    totalReviews: number;
    averageReviewTime: number; // 平均审核时间（小时）
    byReviewer: Record<string, { count: number; avgTime: number }>;
  }> {
    // TODO: 实现审核效率分析
    // 需要从审核记录中统计平均审核时间
    return {
      totalReviews: 0,
      averageReviewTime: 0,
      byReviewer: {},
    };
  }

  /**
   * 人员工作量统计
   */
  static async getUserWorkload(
    _startDate?: Date,
    _endDate?: Date
  ): Promise<{
    byUser: Record<string, {
      projects: number;
      documents: number;
      reviews: number;
      totalScore: number;
    }>;
  }> {
    // TODO: 实现人员工作量统计
    return {
      byUser: {},
    };
  }

  /**
   * 部门绩效报表
   */
  static async getDepartmentPerformance(
    _startDate?: Date,
    _endDate?: Date
  ): Promise<{
    byDepartment: Record<string, {
      projectCount: number;
      bidCount: number;
      wonCount: number;
      winRate: number;
      revenue: number;
    }>;
  }> {
    // TODO: 实现部门绩效报表
    return {
      byDepartment: {},
    };
  }

  /**
   * 财务统计报表
   */
  static async getFinanceStatistics(
    _startDate?: Date,
    _endDate?: Date
  ): Promise<{
    totalRevenue: number;
    totalCost: number;
    profit: number;
    profitMargin: number;
    byMonth: Array<{ month: string; revenue: number; cost: number; profit: number }>;
  }> {
    // TODO: 实现财务统计报表
    return {
      totalRevenue: 0,
      totalCost: 0,
      profit: 0,
      profitMargin: 0,
      byMonth: [],
    };
  }

  /**
   * 生成报表数据（通用方法）
   */
  static async generateReport(
    type: ReportType,
    options: {
      startDate?: Date;
      endDate?: Date;
      filters?: Record<string, any>;
    } = {}
  ): Promise<any> {
    const { startDate, endDate, _filters } = options;

    switch (type) {
      case ReportType.PROJECT_STATISTICS:
        return await this.getProjectStatistics(startDate, endDate);

      case ReportType.DOCUMENT_STATISTICS:
        return await this.getDocumentStatistics(startDate, endDate);

      case ReportType.BID_RATE_ANALYSIS:
        return await this.getBidRateAnalysis(startDate, endDate);

      case ReportType.REVIEW_EFFICIENCY:
        return await this.getReviewEfficiency(startDate, endDate);

      case ReportType.USER_WORKLOAD:
        return await this.getUserWorkload(startDate, endDate);

      case ReportType.DEPARTMENT_PERFORMANCE:
        return await this.getDepartmentPerformance(startDate, endDate);

      case ReportType.FINANCE_STATISTICS:
        return await this.getFinanceStatistics(startDate, endDate);

      default:
        throw new Error(`不支持的报表类型: ${type}`);
    }
  }

  /**
   * 导出报表数据为图表格式
   */
  static formatForChart(data: any, _chartType: 'bar' | 'line' | 'pie' | 'table'): any {
    // TODO: 根据图表类型格式化数据
    return data;
  }
}

// ============================================
// 导出
// ============================================

export default ReportService;

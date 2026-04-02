/**
 * 成本管理服务
 * 提供成本预算、成本记录、成本分析等功能
 */

import { db } from '@/db';
import {
  costBudgets,
  costRecords,
  costReports,
  projects,
  users,
  type CostBudget,
  type NewCostBudget,
  type CostRecord,
  type NewCostRecord,
  type CostReport,
} from '@/db/schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface BudgetWithSpent extends CostBudget {
  spentAmount: string;
  remainingAmount: string;
  usageRate: number;
  creatorName: string | null;
}

export interface CostRecordWithDetails extends CostRecord {
  projectName: string;
  budgetName?: string;
  creatorName: string;
  approverName?: string;
}

export interface CostSummary {
  totalBudget: string;
  totalSpent: string;
  totalRemaining: string;
  usageRate: number;
  byType: Record<string, { budget: string; spent: string; count: number }>;
  byStatus: Record<string, number>;
}

export interface CostTrend {
  date: string;
  budget: string;
  actual: string;
  cumulative: string;
}

// ============================================
// 预算管理
// ============================================

/**
 * 创建成本预算
 */
export async function createBudget(data: NewCostBudget): Promise<CostBudget> {
  const [budget] = await db.insert(costBudgets).values(data).returning();
  return budget;
}

/**
 * 获取项目的预算列表
 */
export async function getBudgetsByProject(projectId: number): Promise<BudgetWithSpent[]> {
  const budgets = await db
    .select({
      id: costBudgets.id,
      projectId: costBudgets.projectId,
      name: costBudgets.name,
      type: costBudgets.type,
      category: costBudgets.category,
      phaseId: costBudgets.phaseId,
      amount: costBudgets.amount,
      currency: costBudgets.currency,
      startDate: costBudgets.startDate,
      endDate: costBudgets.endDate,
      description: costBudgets.description,
      createdBy: costBudgets.createdBy,
      createdAt: costBudgets.createdAt,
      updatedAt: costBudgets.updatedAt,
      creatorName: users.realName,
    })
    .from(costBudgets)
    .leftJoin(users, eq(costBudgets.createdBy, users.id))
    .where(eq(costBudgets.projectId, projectId));

  // 计算每个预算的支出情况
  const results: BudgetWithSpent[] = [];
  
  for (const budget of budgets) {
    const spentResult = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(costRecords)
      .where(
        and(
          eq(costRecords.projectId, projectId),
          eq(costRecords.budgetId, budget.id),
          inArray(costRecords.status, ['approved', 'paid'])
        )
      );

    const spentAmount = spentResult[0]?.total || '0';
    const budgetAmount = parseFloat(budget.amount);
    const spent = parseFloat(spentAmount);
    const remaining = budgetAmount - spent;
    const usageRate = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

    results.push({
      ...budget,
      spentAmount: spentAmount.toString(),
      remainingAmount: remaining.toString(),
      usageRate: Math.round(usageRate * 100) / 100,
    });
  }

  return results;
}

/**
 * 更新预算
 */
export async function updateBudget(id: number, data: Partial<NewCostBudget>): Promise<CostBudget> {
  const [budget] = await db
    .update(costBudgets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(costBudgets.id, id))
    .returning();
  return budget;
}

/**
 * 删除预算
 */
export async function deleteBudget(id: number): Promise<void> {
  // 检查是否有关联的成本记录
  const records = await db
    .select()
    .from(costRecords)
    .where(eq(costRecords.budgetId, id))
    .limit(1);

  if (records.length > 0) {
    throw new Error('该预算下存在成本记录，无法删除');
  }

  await db.delete(costBudgets).where(eq(costBudgets.id, id));
}

// ============================================
// 成本记录管理
// ============================================

/**
 * 创建成本记录
 */
export async function createCostRecord(data: NewCostRecord): Promise<CostRecord> {
  const [record] = await db.insert(costRecords).values(data).returning();
  return record;
}

/**
 * 获取成本记录列表
 */
export async function getCostRecords(
  projectId?: number,
  filters?: {
    type?: string;
    status?: string;
    budgetId?: number;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }
): Promise<{ data: CostRecordWithDetails[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const conditions = [];
  if (projectId) {
    conditions.push(eq(costRecords.projectId, projectId));
  }
  if (filters?.type) {
    conditions.push(eq(costRecords.type, filters.type as any));
  }
  if (filters?.status) {
    conditions.push(eq(costRecords.status, filters.status as any));
  }
  if (filters?.budgetId) {
    conditions.push(eq(costRecords.budgetId, filters.budgetId));
  }
  if (filters?.startDate) {
    conditions.push(gte(costRecords.occurredDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(costRecords.occurredDate, filters.endDate));
  }

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(costRecords)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = countResult[0]?.count || 0;

  // 查询数据
  const records = await db
    .select({
      id: costRecords.id,
      projectId: costRecords.projectId,
      budgetId: costRecords.budgetId,
      type: costRecords.type,
      name: costRecords.name,
      amount: costRecords.amount,
      currency: costRecords.currency,
      status: costRecords.status,
      invoiceNumber: costRecords.invoiceNumber,
      invoiceFile: costRecords.invoiceFile,
      occurredDate: costRecords.occurredDate,
      description: costRecords.description,
      approverId: costRecords.approverId,
      approvedAt: costRecords.approvedAt,
      approvalNote: costRecords.approvalNote,
      createdBy: costRecords.createdBy,
      createdAt: costRecords.createdAt,
      updatedAt: costRecords.updatedAt,
      projectName: projects.name,
      budgetName: costBudgets.name,
      creatorName: users.realName,
      approverName: sql<string | null>`approver.name`,
    })
    .from(costRecords)
    .leftJoin(projects, eq(costRecords.projectId, projects.id))
    .leftJoin(costBudgets, eq(costRecords.budgetId, costBudgets.id))
    .leftJoin(users, eq(costRecords.createdBy, users.id))
    .leftJoin(
      sql`${users} as approver`,
      sql`${costRecords.approverId} = approver.id`
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(costRecords.occurredDate))
    .limit(pageSize)
    .offset(offset);

  return { data: records as CostRecordWithDetails[], total };
}

/**
 * 更新成本记录
 */
export async function updateCostRecord(id: number, data: Partial<NewCostRecord>): Promise<CostRecord> {
  const [record] = await db
    .update(costRecords)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(costRecords.id, id))
    .returning();
  return record;
}

/**
 * 审批成本记录
 */
export async function approveCostRecord(
  id: number,
  approverId: number,
  approved: boolean,
  note?: string
): Promise<CostRecord> {
  const [record] = await db
    .update(costRecords)
    .set({
      status: approved ? 'approved' : 'rejected',
      approverId,
      approvedAt: new Date(),
      approvalNote: note,
      updatedAt: new Date(),
    })
    .where(eq(costRecords.id, id))
    .returning();
  return record;
}

/**
 * 标记为已支付
 */
export async function markAsPaid(id: number): Promise<CostRecord> {
  const [record] = await db
    .update(costRecords)
    .set({
      status: 'paid',
      updatedAt: new Date(),
    })
    .where(eq(costRecords.id, id))
    .returning();
  return record;
}

/**
 * 删除成本记录
 */
export async function deleteCostRecord(id: number): Promise<void> {
  await db.delete(costRecords).where(eq(costRecords.id, id));
}

// ============================================
// 成本统计分析
// ============================================

/**
 * 获取项目成本汇总
 */
export async function getCostSummary(projectId: number): Promise<CostSummary> {
  // 获取总预算
  const budgetResult = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(costBudgets)
    .where(eq(costBudgets.projectId, projectId));

  const totalBudget = budgetResult[0]?.total || '0';

  // 获取已批准/已支付的支出
  const spentResult = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(costRecords)
    .where(
      and(
        eq(costRecords.projectId, projectId),
        inArray(costRecords.status, ['approved', 'paid'])
      )
    );

  const totalSpent = spentResult[0]?.total || '0';

  // 按类型统计
  const typeStats = await db
    .select({
      type: costRecords.type,
      total: sql<string>`COALESCE(SUM(amount), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(costRecords)
    .where(
      and(
        eq(costRecords.projectId, projectId),
        inArray(costRecords.status, ['approved', 'paid'])
      )
    )
    .groupBy(costRecords.type);

  const byType: Record<string, { budget: string; spent: string; count: number }> = {};
  for (const stat of typeStats) {
    byType[stat.type] = {
      budget: '0', // 需要根据预算表计算
      spent: stat.total,
      count: stat.count,
    };
  }

  // 按状态统计
  const statusStats = await db
    .select({
      status: costRecords.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(costRecords)
    .where(eq(costRecords.projectId, projectId))
    .groupBy(costRecords.status);

  const byStatus: Record<string, number> = {};
  for (const stat of statusStats) {
    byStatus[stat.status] = stat.count;
  }

  const budget = parseFloat(totalBudget);
  const spent = parseFloat(totalSpent);
  const remaining = budget - spent;
  const usageRate = budget > 0 ? (spent / budget) * 100 : 0;

  return {
    totalBudget,
    totalSpent,
    totalRemaining: remaining.toString(),
    usageRate: Math.round(usageRate * 100) / 100,
    byType,
    byStatus,
  };
}

/**
 * 获取成本趋势
 */
export async function getCostTrend(
  projectId: number,
  startDate: Date,
  endDate: Date
): Promise<CostTrend[]> {
  const records = await db
    .select({
      date: sql<string>`DATE(${costRecords.occurredDate})`,
      amount: costRecords.amount,
    })
    .from(costRecords)
    .where(
      and(
        eq(costRecords.projectId, projectId),
        gte(costRecords.occurredDate, startDate),
        lte(costRecords.occurredDate, endDate),
        inArray(costRecords.status, ['approved', 'paid'])
      )
    )
    .orderBy(costRecords.occurredDate);

  // 按日期聚合
  const dailyData: Record<string, number> = {};
  for (const record of records) {
    if (!dailyData[record.date]) {
      dailyData[record.date] = 0;
    }
    dailyData[record.date] += parseFloat(record.amount);
  }

  // 获取总预算
  const budgetResult = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(costBudgets)
    .where(eq(costBudgets.projectId, projectId));

  const totalBudget = parseFloat(budgetResult[0]?.total || '0');

  // 计算累计支出
  const result: CostTrend[] = [];
  let cumulative = 0;

  const sortedDates = Object.keys(dailyData).sort();
  for (const date of sortedDates) {
    const daily = dailyData[date];
    cumulative += daily;

    result.push({
      date,
      budget: totalBudget.toString(),
      actual: daily.toString(),
      cumulative: cumulative.toString(),
    });
  }

  return result;
}

// ============================================
// 成本报告
// ============================================

/**
 * 生成成本报告
 */
export async function generateCostReport(projectId: number, userId: number): Promise<CostReport> {
  const summary = await getCostSummary(projectId);
  const _trend = await getCostTrend(
    projectId,
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 最近30天
    new Date()
  );

  const varianceAmount = parseFloat(summary.totalBudget) - parseFloat(summary.totalSpent);
  const varianceRate = summary.usageRate.toString();

  const [report] = await db
    .insert(costReports)
    .values({
      projectId,
      title: `成本分析报告 - ${new Date().toLocaleDateString()}`,
      reportDate: new Date(),
      totalBudget: summary.totalBudget,
      actualCost: summary.totalSpent,
      varianceAmount: varianceAmount.toString(),
      varianceRate: varianceRate.toString(),
      costByType: JSON.stringify(summary.byType),
      costByPhase: JSON.stringify({}), // 需要根据项目阶段计算
      analysis: '',
      recommendations: '',
      createdBy: userId,
    })
    .returning();

  return report;
}

/**
 * 获取成本报告列表
 */
export async function getCostReports(projectId: number): Promise<CostReport[]> {
  const reports = await db
    .select()
    .from(costReports)
    .where(eq(costReports.projectId, projectId))
    .orderBy(desc(costReports.reportDate));

  return reports;
}

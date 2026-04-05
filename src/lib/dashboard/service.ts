/**
 * 项目看板服务
 * 提供项目统计、进度追踪、数据分析等功能
 */

import { db } from '@/db';
import {
  projects,
  projectMembers,
  projectMilestones,
  projectPhases as _projectPhases,
  bidDocuments,
  bidChapters as _bidChapters,
  bidDocumentInterpretations,
  reviewReports,
  knowledgeItems,
  users,
  departments,
} from '@/db/schema';
import { eq, and, or as _or, desc, asc, count, sum as _sum, avg, sql, gte, lte, between, isNull, isNotNull } from 'drizzle-orm';
import { startOfMonth, endOfMonth, startOfWeek as _startOfWeek, endOfWeek as _endOfWeek, subDays, subMonths, format } from 'date-fns';

// ============================================
// 类型定义
// ============================================

export interface DashboardOverview {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  totalDocuments: number;
  pendingReviews: number;
  pendingInterpretationReviews: number;
  totalKnowledge: number;
  myTasks: number;
}

export interface ProjectTrend {
  date: string;
  created: number;
  completed: number;
}

export interface DepartmentStats {
  departmentId: number;
  departmentName: string;
  projectCount: number;
  completedCount: number;
  avgProgress: number;
}

export interface RecentActivity {
  id: number;
  type: string;
  title: string;
  description: string;
  userName: string;
  createdAt: Date;
}

export interface MilestoneStatus {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface DocumentStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  avgDuration: number; // 平均审校时间（小时）
}

// ============================================
// 看板服务
// ============================================

/**
 * 获取看板概览数据
 */
export async function getDashboardOverview(userId: number): Promise<DashboardOverview> {
  // 获取用户所在部门
  const user = await db
    .select({ departmentId: users.departmentId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const departmentId = user[0]?.departmentId;

  // 统计项目数量
  const projectStats = await db
    .select({
      status: projects.status,
      count: count(),
    })
    .from(projects)
    .where(departmentId ? eq(projects.departmentId, departmentId) : undefined)
    .groupBy(projects.status);

  const projectCounts: Record<string, number> = {};
  projectStats.forEach((stat) => {
    projectCounts[stat.status] = stat.count;
  });

  // 统计文档数量
  const docCount = await db
    .select({ count: count() })
    .from(bidDocuments);

  // 统计待审校数量
  const reviewCount = await db
    .select({ count: count() })
    .from(reviewReports)
    .where(eq(reviewReports.status, 'pending'));

// 统计待审核解读数量
  const interpretationReviewCount = await db
    .select({ count: count() })
    .from(bidDocumentInterpretations)
    .where(
      and(
        eq(bidDocumentInterpretations.status, 'completed'),
        or(
          eq(bidDocumentInterpretations.reviewStatus, 'pending'),
          isNull(bidDocumentInterpretations.reviewStatus)
        )
      )
    );

  return {
    totalProjects: Object.values(projectCounts).reduce((a, b) => a + b, 0),
    activeProjects: projectCounts['preparing'] || 0,
    completedProjects: projectCounts['approved'] || 0,
    overdueProjects: overdueCount[0]?.count || 0,
    totalDocuments: docCount[0]?.count || 0,
    pendingReviews: reviewCount[0]?.count || 0,
    pendingInterpretationReviews: interpretationReviewCount[0]?.count || 0,
    totalKnowledge: knowledgeCount[0]?.count || 0,
    myTasks: myTasks[0]?.count || 0,
  };
}

/**
 * 获取项目趋势数据
 */
export async function getProjectTrend(months: number = 6): Promise<ProjectTrend[]> {
  const now = new Date();
  const startDate = subMonths(now, months);

  const createdProjects = await db
    .select({
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(gte(projects.createdAt, startDate));

  const completedProjects = await db
    .select({
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(
      and(
        eq(projects.status, 'approved'),
        gte(projects.updatedAt, startDate)
      )
    );

  // 按月份分组统计
  const trendData: ProjectTrend[] = [];
  for (let i = months; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(subMonths(now, i));
    const monthStr = format(monthStart, 'yyyy-MM');

    const created = createdProjects.filter(
      (p) => p.createdAt >= monthStart && p.createdAt <= monthEnd
    ).length;

    const completed = completedProjects.filter(
      (p) => p.updatedAt && p.updatedAt >= monthStart && p.updatedAt <= monthEnd
    ).length;

    trendData.push({
      date: monthStr,
      created,
      completed,
    });
  }

  return trendData;
}

/**
 * 获取部门统计
 */
export async function getDepartmentStats(): Promise<DepartmentStats[]> {
  const allDepartments = await db
    .select()
    .from(departments);

  const stats: DepartmentStats[] = [];

  for (const dept of allDepartments) {
    const projectCount = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.departmentId, dept.id));

    const completedCount = await db
      .select({ count: count() })
      .from(projects)
      .where(
        and(
          eq(projects.departmentId, dept.id),
          eq(projects.status, 'approved')
        )
      );

    const avgProgressResult = await db
      .select({ avg: avg(projects.progress) })
      .from(projects)
      .where(eq(projects.departmentId, dept.id));

    stats.push({
      departmentId: dept.id,
      departmentName: dept.name,
      projectCount: projectCount[0]?.count || 0,
      completedCount: completedCount[0]?.count || 0,
      avgProgress: Math.round(Number(avgProgressResult[0]?.avg) || 0),
    });
  }

  return stats.sort((a, b) => b.projectCount - a.projectCount);
}

/**
 * 获取最近活动
 */
export async function getRecentActivities(
  userId: number,
  limit: number = 10
): Promise<RecentActivity[]> {
  const activities: RecentActivity[] = [];

  // 最近创建的项目
  const recentProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      ownerId: projects.ownerId,
    })
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(limit);

  for (const project of recentProjects) {
    const owner = await db
      .select({ name: users.realName })
      .from(users)
      .where(eq(users.id, project.ownerId))
      .limit(1);

    activities.push({
      id: project.id,
      type: 'project_created',
      title: '新建项目',
      description: project.name,
      userName: owner[0]?.name || '未知',
      createdAt: project.createdAt,
    });
  }

  // 最近完成的项目
  const completedProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      updatedAt: projects.updatedAt,
      ownerId: projects.ownerId,
    })
    .from(projects)
    .where(eq(projects.status, 'approved'))
    .orderBy(desc(projects.updatedAt))
    .limit(limit);

  for (const project of completedProjects) {
    const owner = await db
      .select({ name: users.realName })
      .from(users)
      .where(eq(users.id, project.ownerId))
      .limit(1);

    activities.push({
      id: project.id,
      type: 'project_completed',
      title: '完成项目',
      description: project.name,
      userName: owner[0]?.name || '未知',
      createdAt: project.updatedAt || new Date(),
    });
  }

  // 按时间排序并限制数量
  return activities
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * 获取里程碑状态统计
 */
export async function getMilestoneStatus(projectId?: number): Promise<MilestoneStatus> {
  const conditions = projectId ? [eq(projectMilestones.projectId, projectId)] : [];

  const stats = await db
    .select({
      status: projectMilestones.status,
      count: count(),
    })
    .from(projectMilestones)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projectMilestones.status);

  const result: MilestoneStatus = {
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  };

  stats.forEach((stat) => {
    if (stat.status === 'pending') result.pending = stat.count;
    else if (stat.status === 'in_progress') result.inProgress = stat.count;
    else if (stat.status === 'completed') result.completed = stat.count;
    else if (stat.status === 'overdue') result.overdue = stat.count;
  });

  return result;
}

/**
 * 获取文档统计
 */
export async function getDocumentStats(projectId?: number): Promise<DocumentStats> {
  const conditions = projectId ? [eq(bidDocuments.projectId, projectId)] : [];

  // 按状态统计
  const statusStats = await db
    .select({
      status: bidDocuments.status,
      count: count(),
    })
    .from(bidDocuments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(bidDocuments.status);

  const byStatus: Record<string, number> = {};
  statusStats.forEach((stat) => {
    byStatus[stat.status] = stat.count;
  });

  const byType: Record<string, number> = {};
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return {
    total,
    byStatus,
    byType,
  };
}

/**
 * 获取审校统计
 */
export async function getReviewStats(projectId?: number): Promise<ReviewStats> {
  // 由于 reviewReports 关联的是 documentId，需要先获取项目的文档
  let docIds: number[] = [];
  if (projectId) {
    const docs = await db
      .select({ id: bidDocuments.id })
      .from(bidDocuments)
      .where(eq(bidDocuments.projectId, projectId));
    docIds = docs.map((d) => d.id);
  }

  const conditions = docIds.length > 0
    ? [sql`${reviewReports.documentId} IN (${sql.join(docIds.map(id => sql`${id}`), sql`, `)})`]
    : [];

  const statusStats = await db
    .select({
      status: reviewReports.status,
      count: count(),
    })
    .from(reviewReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(reviewReports.status);

  const statusCounts: Record<string, number> = {};
  statusStats.forEach((stat) => {
    statusCounts[stat.status] = stat.count;
  });

  // 计算平均审校时间
  const completedReviews = await db
    .select({
      createdAt: reviewReports.createdAt,
      updatedAt: reviewReports.updatedAt,
    })
    .from(reviewReports)
    .where(
      and(
        conditions.length > 0 ? and(...conditions) : undefined,
        isNotNull(reviewReports.updatedAt)
      )
    );

  let totalDuration = 0;
  completedReviews.forEach((review) => {
    if (review.updatedAt && review.createdAt) {
      const duration = review.updatedAt.getTime() - review.createdAt.getTime();
      totalDuration += duration;
    }
  });

  const avgDuration = completedReviews.length > 0
    ? Math.round(totalDuration / completedReviews.length / (1000 * 60 * 60)) // 转换为小时
    : 0;

  return {
    total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    pending: statusCounts['draft'] || 0,
    approved: statusCounts['published'] || 0,
    rejected: 0, // reviewReports 没有 rejected 状态
    avgDuration,
  };
}

/**
 * 获取用户项目列表（看板视图）
 */
export async function getUserProjects(
  userId: number,
  options: {
    status?: string;
    role?: string;
    limit?: number;
  } = {}
) {
  const { status, role: _role, limit = 10 } = options;

  // 获取用户参与的项目
  const memberProjects = await db
    .select({
      project: projects,
      member: projectMembers,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId))
    .orderBy(desc(projects.createdAt))
    .limit(limit);

  // 获取用户负责的项目
  const ownedProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId))
    .orderBy(desc(projects.createdAt))
    .limit(limit);

  // 合并去重
  const projectMap = new Map<number, typeof projects.$inferSelect>();

  ownedProjects.forEach((p) => {
    projectMap.set(p.id, p);
  });

  memberProjects.forEach(({ project }) => {
    if (!projectMap.has(project.id)) {
      projectMap.set(project.id, project);
    }
  });

  let projectsList = Array.from(projectMap.values());

  // 过滤状态
  if (status) {
    projectsList = projectsList.filter((p) => p.status === status);
  }

  return projectsList;
}

/**
 * 获取即将到期的里程碑
 */
export async function getUpcomingMilestones(
  userId: number,
  days: number = 7
): Promise<Array<{
  id: number;
  projectName: string;
  milestoneName: string;
  dueDate: Date;
  daysRemaining: number;
}>> {
  const now = new Date();
  const endDate = subDays(now, -days); // days天后

  const milestones = await db
    .select({
      milestone: projectMilestones,
      project: projects,
    })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(
      and(
        eq(projectMilestones.status, 'pending'),
        eq(projects.ownerId, userId),
        between(projectMilestones.dueDate, now, endDate)
      )
    )
    .orderBy(asc(projectMilestones.dueDate));

  return milestones.map(({ milestone, project }) => ({
    id: milestone.id,
    projectName: project.name,
    milestoneName: milestone.name,
    dueDate: milestone.dueDate,
    daysRemaining: Math.ceil((milestone.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

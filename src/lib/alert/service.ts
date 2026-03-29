/**
 * 风险预警系统
 * 提供资质预警、截止时间预警、合规检查等功能
 */

import { db } from '@/db';
import {
  qualifications,
  projects,
  competitors as _competitors,
  bidDecisions as _bidDecisions,
} from '@/db/schema';
import { eq, and, lte, gte, lt, desc as _desc, sql as _sql } from 'drizzle-orm';
import { notificationService } from '@/lib/notification/service';

// ============================================
// 预警类型定义
// ============================================

export interface Alert {
  id: string;
  type: 'qualification' | 'deadline' | 'compliance' | 'competitor' | 'system';
  level: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  projectId?: number;
  projectName?: string;
  entityId?: number;
  entityType?: string;
  dueDate?: Date;
  actionRequired?: string;
  actionUrl?: string;
  createdAt: Date;
}

// ============================================
// 资质预警服务
// ============================================

export class QualificationAlertService {
  /**
   * 获取即将到期的资质
   */
  async getExpiringQualifications(days: number = 30): Promise<Alert[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const expiringList = await db
      .select()
      .from(qualifications)
      .where(
        and(
          eq(qualifications.status, 'valid'),
          gte(qualifications.validTo, today),
          lte(qualifications.validTo, futureDate)
        )
      )
      .orderBy(qualifications.validTo);

    return expiringList.map((q) => {
      const validToDate = q.validTo ? new Date(q.validTo) : new Date();
      const remainingDays = Math.ceil(
        (validToDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let level: Alert['level'] = 'low';
      if (remainingDays <= 7) level = 'critical';
      else if (remainingDays <= 15) level = 'high';
      else if (remainingDays <= 30) level = 'medium';

      return {
        id: `qual-${q.id}`,
        type: 'qualification',
        level,
        title: `资质证照即将到期：${q.name}`,
        message: `资质 "${q.name}" 将在 ${remainingDays} 天后到期（${validToDate.toLocaleDateString('zh-CN')}），请及时办理续期。`,
        entityId: q.id,
        entityType: 'qualification',
        dueDate: validToDate,
        actionRequired: '办理资质续期',
        actionUrl: `/qualifications/${q.id}`,
        createdAt: new Date(),
      };
    });
  }

  /**
   * 获取已过期的资质
   */
  async getExpiredQualifications(): Promise<Alert[]> {
    const today = new Date();

    const expiredList = await db
      .select()
      .from(qualifications)
      .where(
        and(
          eq(qualifications.status, 'valid'),
          lt(qualifications.validTo, today)
        )
      );

    return expiredList.map((q) => {
      const validToDate = q.validTo ? new Date(q.validTo) : new Date();
      return {
        id: `qual-expired-${q.id}`,
        type: 'qualification' as const,
        level: 'critical' as const,
        title: `资质证照已过期：${q.name}`,
        message: `资质 "${q.name}" 已于 ${validToDate.toLocaleDateString('zh-CN')} 过期，请立即处理。`,
        entityId: q.id,
        entityType: 'qualification',
        dueDate: validToDate,
        actionRequired: '立即更新资质',
        actionUrl: `/qualifications/${q.id}`,
        createdAt: new Date(),
      };
    });
  }

  /**
   * 发送资质到期提醒
   */
  async sendExpirationAlerts(): Promise<void> {
    const alerts = await this.getExpiringQualifications(7);
    
    for (const alert of alerts) {
      // 发送给资质管理员
      await notificationService.broadcast(
        [], // TODO: 获取资质管理员列表
        {
          title: alert.title,
          content: alert.message,
          type: 'warning',
          data: { alertId: alert.id },
        },
        [
          { type: 'email', enabled: true },
          { type: 'wechat', enabled: true },
        ]
      );
    }
  }
}

// ============================================
// 截止时间预警服务
// ============================================

export class DeadlineAlertService {
  /**
   * 获取即将到期的项目截止时间
   */
  async getUpcomingDeadlines(days: number = 7): Promise<Alert[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const projectsList = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.status, 'preparing'),
          gte(projects.submissionDeadline, today),
          lte(projects.submissionDeadline, futureDate)
        )
      )
      .orderBy(projects.submissionDeadline);

    return projectsList.map((p) => {
      const deadline = p.submissionDeadline ? new Date(p.submissionDeadline) : new Date();
      const remainingDays = Math.ceil(
        (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let level: Alert['level'] = 'low';
      if (remainingDays <= 1) level = 'critical';
      else if (remainingDays <= 3) level = 'high';
      else if (remainingDays <= 7) level = 'medium';

      return {
        id: `deadline-${p.id}`,
        type: 'deadline',
        level,
        title: `投标截止时间提醒：${p.name}`,
        message: `项目 "${p.name}" 的投标截止时间为 ${deadline.toLocaleString('zh-CN')}，剩余 ${remainingDays} 天。`,
        projectId: p.id,
        projectName: p.name,
        dueDate: deadline,
        actionRequired: '完成投标文件',
        actionUrl: `/projects/${p.id}`,
        createdAt: new Date(),
      };
    });
  }

  /**
   * 获取已逾期的项目
   */
  async getOverdueProjects(): Promise<Alert[]> {
    const today = new Date();

    const overdueList = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.status, 'preparing'),
          lt(projects.submissionDeadline, today)
        )
      );

    return overdueList.map((p) => {
      const deadline = p.submissionDeadline ? new Date(p.submissionDeadline) : new Date();
      return {
        id: `deadline-overdue-${p.id}`,
        type: 'deadline' as const,
        level: 'critical' as const,
        title: `项目已逾期：${p.name}`,
        message: `项目 "${p.name}" 已于 ${deadline.toLocaleString('zh-CN')} 截止，请确认项目状态。`,
        projectId: p.id,
        projectName: p.name,
        dueDate: deadline,
        actionRequired: '更新项目状态',
        actionUrl: `/projects/${p.id}`,
        createdAt: new Date(),
      };
    });
  }
}

// ============================================
// 合规检查服务
// ============================================

export class ComplianceCheckService {
  /**
   * 检查项目合规性
   */
  async checkProjectCompliance(projectId: number): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) return alerts;

    // 检查必要的项目信息
    if (!project.submissionDeadline) {
      alerts.push({
        id: `compliance-${projectId}-deadline`,
        type: 'compliance',
        level: 'high',
        title: '项目缺少投标截止时间',
        message: `项目 "${project.name}" 未设置投标截止时间，可能影响项目进度跟踪。`,
        projectId,
        projectName: project.name,
        actionRequired: '设置投标截止时间',
        actionUrl: `/projects/${projectId}`,
        createdAt: new Date(),
      });
    }

    // TODO: 添加更多合规检查规则

    return alerts;
  }

  /**
   * 批量检查所有活跃项目
   */
  async checkAllProjects(): Promise<Alert[]> {
    const allAlerts: Alert[] = [];
    
    const activeProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.status, 'preparing'));

    for (const project of activeProjects) {
      const alerts = await this.checkProjectCompliance(project.id);
      allAlerts.push(...alerts);
    }

    return allAlerts;
  }
}

// ============================================
// 综合预警服务
// ============================================

export class AlertService {
  private qualificationService: QualificationAlertService;
  private deadlineService: DeadlineAlertService;
  private complianceService: ComplianceCheckService;

  constructor() {
    this.qualificationService = new QualificationAlertService();
    this.deadlineService = new DeadlineAlertService();
    this.complianceService = new ComplianceCheckService();
  }

  /**
   * 获取所有预警
   */
  async getAllAlerts(): Promise<Alert[]> {
    const [
      expiringQualifications,
      expiredQualifications,
      upcomingDeadlines,
      overdueProjects,
      complianceIssues,
    ] = await Promise.all([
      this.qualificationService.getExpiringQualifications(30),
      this.qualificationService.getExpiredQualifications(),
      this.deadlineService.getUpcomingDeadlines(7),
      this.deadlineService.getOverdueProjects(),
      this.complianceService.checkAllProjects(),
    ]);

    return [
      ...expiredQualifications,
      ...overdueProjects,
      ...expiringQualifications,
      ...upcomingDeadlines,
      ...complianceIssues,
    ].sort((a, b) => {
      // 按级别排序
      const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return levelOrder[a.level] - levelOrder[b.level];
    });
  }

  /**
   * 获取指定项目的预警
   */
  async getProjectAlerts(projectId: number): Promise<Alert[]> {
    const allAlerts = await this.getAllAlerts();
    return allAlerts.filter((alert) => alert.projectId === projectId);
  }

  /**
   * 获取预警统计
   */
  async getAlertStatistics(): Promise<{
    total: number;
    byLevel: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const alerts = await this.getAllAlerts();

    return {
      total: alerts.length,
      byLevel: {
        critical: alerts.filter((a) => a.level === 'critical').length,
        high: alerts.filter((a) => a.level === 'high').length,
        medium: alerts.filter((a) => a.level === 'medium').length,
        low: alerts.filter((a) => a.level === 'low').length,
      },
      byType: {
        qualification: alerts.filter((a) => a.type === 'qualification').length,
        deadline: alerts.filter((a) => a.type === 'deadline').length,
        compliance: alerts.filter((a) => a.type === 'compliance').length,
      },
    };
  }

  /**
   * 执行定时预警检查
   */
  async runScheduledCheck(): Promise<void> {
    console.log('[AlertService] Running scheduled alert check...');
    
    // 发送资质到期提醒
    await this.qualificationService.sendExpirationAlerts();
    
    // TODO: 发送截止时间提醒
    // TODO: 发送合规问题提醒
    
    console.log('[AlertService] Scheduled alert check completed');
  }
}

// 导出单例
export const alertService = new AlertService();
export const qualificationAlertService = new QualificationAlertService();
export const deadlineAlertService = new DeadlineAlertService();
export const complianceCheckService = new ComplianceCheckService();

/**
 * 自动化任务调度服务
 * 使用 node-cron 实现定时任务
 */

import cron, { type ScheduledTask as CronScheduledTask } from 'node-cron';
import { db as _db } from '@/db/index';
import { cache as _cache } from '@/lib/cache';
import { sendNotificationToUser as _sendNotificationToUser, NotificationType as _NotificationType } from '@/lib/realtime/websocket-server';

// ============================================
// 调度任务类型
// ============================================

export enum ScheduledTaskType {
  DAILY_SUMMARY = 'daily_summary',
  WEEKLY_REPORT = 'weekly_report',
  MONTHLY_REPORT = 'monthly_report',
  DEADLINE_REMINDER = 'deadline_reminder',
  DATA_ARCHIVE = 'data_archive',
  DATA_BACKUP = 'data_backup',
  CLEANUP_CACHE = 'cleanup_cache',
}

// ============================================
// 调度任务接口
// ============================================

export interface ScheduledTask {
  id: string;
  type: ScheduledTaskType;
  name: string;
  description?: string;
  cron: string; // cron表达式
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
}

// ============================================
// 调度服务类
// ============================================

export class SchedulerService {
  private static tasks: Map<string, ScheduledTask> = new Map();
  private static cronJobs: Map<string, CronScheduledTask> = new Map();

  /**
   * 初始化调度服务
   */
  static async initialize(): Promise<void> {
    console.log('[Scheduler] 初始化任务调度服务');

    // 注册默认任务
    this.registerDefaultTasks();

    // 启动所有启用的任务
    this.startAllTasks();
  }

  /**
   * 注册默认任务
   */
  private static registerDefaultTasks(): void {
    // 每日项目提醒（每天早上9点）
    this.registerTask({
      id: 'daily_reminder',
      type: ScheduledTaskType.DEADLINE_REMINDER,
      name: '每日项目提醒',
      description: '每天9点提醒即将到期的项目',
      cron: '0 9 * * *',
      enabled: true,
      runCount: 0,
      handler: async () => {
        await this.sendDailyReminders();
      },
    });

    // 每周工作汇总（每周一早上9点）
    this.registerTask({
      id: 'weekly_summary',
      type: ScheduledTaskType.WEEKLY_REPORT,
      name: '每周工作汇总',
      description: '每周一早上9点生成工作汇总',
      cron: '0 9 * * 1',
      enabled: true,
      runCount: 0,
      handler: async () => {
        await this.generateWeeklySummary();
      },
    });

    // 每月统计报表（每月1号凌晨1点）
    this.registerTask({
      id: 'monthly_report',
      type: ScheduledTaskType.MONTHLY_REPORT,
      name: '每月统计报表',
      description: '每月1号凌晨1点生成统计报表',
      cron: '0 1 1 * *',
      enabled: true,
      runCount: 0,
      handler: async () => {
        await this.generateMonthlyReport();
      },
    });

    // 自动数据归档（每天凌晨2点）
    this.registerTask({
      id: 'data_archive',
      type: ScheduledTaskType.DATA_ARCHIVE,
      name: '自动数据归档',
      description: '每天凌晨2点归档旧数据',
      cron: '0 2 * * *',
      enabled: true,
      runCount: 0,
      handler: async () => {
        await this.archiveOldData();
      },
    });

    // 清理缓存（每天凌晨3点）
    this.registerTask({
      id: 'cleanup_cache',
      type: ScheduledTaskType.CLEANUP_CACHE,
      name: '清理缓存',
      description: '每天凌晨3点清理过期缓存',
      cron: '0 3 * * *',
      enabled: true,
      runCount: 0,
      handler: async () => {
        await this.cleanupCache();
      },
    });
  }

  /**
   * 注册任务
   */
  static registerTask(task: ScheduledTask & { handler: () => Promise<void> }): void {
    this.tasks.set(task.id, task);

    console.log(`[Scheduler] 注册任务: ${task.name} (${task.cron})`);
  }

  /**
   * 启动任务
   */
  static startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (this.cronJobs.has(taskId)) {
      console.warn(`[Scheduler] 任务已在运行: ${taskId}`);
      return;
    }

    const cronJob = cron.schedule(task.cron, async () => {
      await this.executeTask(taskId);
    }, {
      timezone: 'Asia/Shanghai',
    });

    this.cronJobs.set(taskId, cronJob);
    console.log(`[Scheduler] 启动任务: ${task.name}`);
  }

  /**
   * 停止任务
   */
  static stopTask(taskId: string): void {
    const cronJob = this.cronJobs.get(taskId);
    if (!cronJob) {
      return;
    }

    cronJob.stop();
    this.cronJobs.delete(taskId);
    console.log(`[Scheduler] 停止任务: ${taskId}`);
  }

  /**
   * 启动所有任务
   */
  static startAllTasks(): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.enabled) {
        this.startTask(taskId);
      }
    }
  }

  /**
   * 停止所有任务
   */
  static stopAllTasks(): void {
    for (const taskId of this.cronJobs.keys()) {
      this.stopTask(taskId);
    }
  }

  /**
   * 执行任务
   */
  private static async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    console.log(`[Scheduler] 执行任务: ${task.name}`);

    const startTime = Date.now();

    try {
      // 获取任务处理器（需要从外部注册）
      const handler = (task as any).handler;
      if (!handler) {
        throw new Error('任务处理器未定义');
      }

      await handler();

      // 更新任务状态
      task.lastRun = new Date();
      task.runCount++;
      task.lastStatus = 'success';
      task.lastError = undefined;

      const duration = Date.now() - startTime;
      console.log(`[Scheduler] 任务执行成功: ${task.name} (${duration}ms)`);
    } catch (error) {
      task.lastRun = new Date();
      task.runCount++;
      task.lastStatus = 'failed';
      task.lastError = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[Scheduler] 任务执行失败: ${task.name}`, error);
    }
  }

  /**
   * 发送每日提醒
   */
  private static async sendDailyReminders(): Promise<void> {
    // TODO: 查询即将到期的项目
    // const projects = await db.query.projects.findMany({
    //   where: and(
    //     gte(projects.deadline, new Date()),
    //     lte(projects.deadline, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    //   )
    // });

    // 发送提醒通知
    // for (const project of projects) {
    //   await sendNotificationToUser(project.createdBy, {
    //     type: NotificationType.DEADLINE_REMINDER,
    //     title: '项目即将到期',
    //     message: `项目"${project.name}"将于${project.deadline}到期`,
    //     priority: 'high',
    //   });
    // }

    console.log('[Scheduler] 发送每日提醒完成');
  }

  /**
   * 生成每周汇总
   */
  private static async generateWeeklySummary(): Promise<void> {
    // TODO: 生成每周工作汇总报告
    console.log('[Scheduler] 生成每周汇总完成');
  }

  /**
   * 生成每月报表
   */
  private static async generateMonthlyReport(): Promise<void> {
    // TODO: 生成每月统计报表
    console.log('[Scheduler] 生成每月报表完成');
  }

  /**
   * 归档旧数据
   */
  private static async archiveOldData(): Promise<void> {
    // TODO: 归档超过6个月的数据
    const cutoffDate = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    console.log(`[Scheduler] 归档${cutoffDate}之前的数据`);
  }

  /**
   * 清理缓存
   */
  private static async cleanupCache(): Promise<void> {
    // TODO: 清理过期缓存
    console.log('[Scheduler] 清理缓存完成');
  }

  /**
   * 获取所有任务
   */
  static getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取任务状态
   */
  static getTaskStatus(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 更新任务
   */
  static updateTask(taskId: string, updates: Partial<ScheduledTask>): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    Object.assign(task, updates);

    // 如果启用状态改变，重新启动任务
    if ('enabled' in updates) {
      if (updates.enabled) {
        this.startTask(taskId);
      } else {
        this.stopTask(taskId);
      }
    }

    console.log(`[Scheduler] 更新任务: ${task.name}`);
  }
}

// ============================================
// 导出
// ============================================

export default SchedulerService;

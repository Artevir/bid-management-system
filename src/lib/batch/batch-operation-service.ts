/**
 * 批量操作服务
 * 支持批量导入、批量导出、批量审核、批量归档等操作
 * 使用任务队列处理大量数据
 */

import { db } from '@/db/index';
import { cache } from '@/lib/cache';
import { pushProjectUpdate } from '@/lib/realtime/websocket-server';

// ============================================
// 批量操作类型
// ============================================

export enum BatchOperationType {
  BATCH_IMPORT = 'batch_import',
  BATCH_EXPORT = 'batch_export',
  BATCH_DELETE = 'batch_delete',
  BATCH_UPDATE = 'batch_update',
  BATCH_APPROVE = 'batch_approve',
  BATCH_REJECT = 'batch_reject',
  BATCH_ARCHIVE = 'batch_archive',
  BATCH_RESTORE = 'batch_restore',
}

// ============================================
// 批量操作状态
// ============================================

export enum BatchOperationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// ============================================
// 批量操作任务接口
// ============================================

export interface BatchOperationTask {
  id: string;
  type: BatchOperationType;
  status: BatchOperationStatus;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  result?: any;
  userId: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
}

// ============================================
// 批量操作配置
// ============================================

export interface BatchOperationOptions {
  userId: string;
  batchSize?: number; // 每批处理数量
  maxConcurrent?: number; // 最大并发数
  continueOnError?: boolean; // 遇到错误是否继续
  notify?: boolean; // 是否发送通知
}

// ============================================
// 批量操作服务类
// ============================================

export class BatchOperationService {
  private static tasks: Map<string, BatchOperationTask> = new Map();
  private static processingTasks: Set<string> = new Set();

  /**
   * 创建批量操作任务
   */
  static async createTask(
    type: BatchOperationType,
    total: number,
    options: BatchOperationOptions
  ): Promise<string> {
    const taskId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task: BatchOperationTask = {
      id: taskId,
      type,
      status: BatchOperationStatus.PENDING,
      total,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      userId: options.userId,
      createdAt: new Date(),
      progress: 0,
    };

    this.tasks.set(taskId, task);

    // 缓存任务信息
    await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);

    console.log(`[Batch] 创建任务: ${taskId}, 类型: ${type}, 总数: ${total}`);

    return taskId;
  }

  /**
   * 获取任务状态
   */
  static async getTaskStatus(taskId: string): Promise<BatchOperationTask | null> {
    // 先从缓存获取
    const cached = await cache.get(`batch:task:${taskId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // 从内存获取
    return this.tasks.get(taskId) || null;
  }

  /**
   * 取消任务
   */
  static async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    if (task.status === BatchOperationStatus.RUNNING) {
      // 标记为取消中
      this.processingTasks.delete(taskId);
      task.status = BatchOperationStatus.CANCELLED;
      task.completedAt = new Date();
      
      await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);
      return true;
    }

    return false;
  }

  /**
   * 批量删除
   */
  static async batchDelete(
    resourceType: string,
    ids: string[],
    options: BatchOperationOptions
  ): Promise<string> {
    const taskId = await this.createTask(BatchOperationType.BATCH_DELETE, ids.length, options);

    // 异步执行
    this.executeBatchDelete(taskId, resourceType, ids, options).catch(error => {
      console.error(`[Batch] 批量删除失败:`, error);
    });

    return taskId;
  }

  /**
   * 执行批量删除
   */
  private static async executeBatchDelete(
    taskId: string,
    resourceType: string,
    ids: string[],
    options: BatchOperationOptions
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.processingTasks.add(taskId);
    task.status = BatchOperationStatus.RUNNING;
    task.startedAt = new Date();
    await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);

    const batchSize = options.batchSize || 100;
    const continueOnError = options.continueOnError !== false;

    for (let i = 0; i < ids.length; i += batchSize) {
      // 检查是否被取消
      if (!this.processingTasks.has(taskId)) {
        break;
      }

      const batch = ids.slice(i, i + batchSize);

      for (const id of batch) {
        try {
          // TODO: 根据资源类型执行删除
          // 示例：
          // if (resourceType === 'project') {
          //   await db.delete(projects).where(eq(projects.id, id));
          // }

          task.succeeded++;
        } catch (error) {
          task.failed++;
          task.errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (!continueOnError) {
            task.status = BatchOperationStatus.FAILED;
            task.completedAt = new Date();
            await this.finalizeTask(taskId);
            return;
          }
        }

        task.processed++;
        task.progress = Math.round((task.processed / task.total) * 100);

        // 更新进度（每处理10个更新一次）
        if (task.processed % 10 === 0) {
          await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);
          
          // 发送WebSocket通知
          if (options.notify) {
            // pushProjectUpdate(taskId, { ... });
          }
        }
      }
    }

    await this.finalizeTask(taskId);
  }

  /**
   * 批量更新
   */
  static async batchUpdate(
    resourceType: string,
    ids: string[],
    updateData: any,
    options: BatchOperationOptions
  ): Promise<string> {
    const taskId = await this.createTask(BatchOperationType.BATCH_UPDATE, ids.length, options);

    // 异步执行
    this.executeBatchUpdate(taskId, resourceType, ids, updateData, options).catch(error => {
      console.error(`[Batch] 批量更新失败:`, error);
    });

    return taskId;
  }

  /**
   * 执行批量更新
   */
  private static async executeBatchUpdate(
    taskId: string,
    resourceType: string,
    ids: string[],
    updateData: any,
    options: BatchOperationOptions
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.processingTasks.add(taskId);
    task.status = BatchOperationStatus.RUNNING;
    task.startedAt = new Date();
    await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);

    const batchSize = options.batchSize || 100;
    const continueOnError = options.continueOnError !== false;

    for (let i = 0; i < ids.length; i += batchSize) {
      if (!this.processingTasks.has(taskId)) {
        break;
      }

      const batch = ids.slice(i, i + batchSize);

      for (const id of batch) {
        try {
          // TODO: 根据资源类型执行更新
          // 示例：
          // if (resourceType === 'project') {
          //   await db.update(projects)
          //     .set(updateData)
          //     .where(eq(projects.id, id));
          // }

          task.succeeded++;
        } catch (error) {
          task.failed++;
          task.errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          if (!continueOnError) {
            task.status = BatchOperationStatus.FAILED;
            task.completedAt = new Date();
            await this.finalizeTask(taskId);
            return;
          }
        }

        task.processed++;
        task.progress = Math.round((task.processed / task.total) * 100);

        if (task.processed % 10 === 0) {
          await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);
        }
      }
    }

    await this.finalizeTask(taskId);
  }

  /**
   * 批量审核
   */
  static async batchApprove(
    resourceType: string,
    ids: string[],
    options: BatchOperationOptions
  ): Promise<string> {
    const taskId = await this.createTask(BatchOperationType.BATCH_APPROVE, ids.length, options);

    // 异步执行
    this.executeBatchApprove(taskId, resourceType, ids, options).catch(error => {
      console.error(`[Batch] 批量审核失败:`, error);
    });

    return taskId;
  }

  /**
   * 执行批量审核
   */
  private static async executeBatchApprove(
    taskId: string,
    resourceType: string,
    ids: string[],
    options: BatchOperationOptions
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.processingTasks.add(taskId);
    task.status = BatchOperationStatus.RUNNING;
    task.startedAt = new Date();
    await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);

    for (const id of ids) {
      if (!this.processingTasks.has(taskId)) {
        break;
      }

      try {
        // TODO: 执行审核逻辑
        task.succeeded++;
      } catch (error) {
        task.failed++;
        task.errors.push({
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      task.processed++;
      task.progress = Math.round((task.processed / task.total) * 100);

      if (task.processed % 10 === 0) {
        await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);
      }
    }

    await this.finalizeTask(taskId);
  }

  /**
   * 完成任务
   */
  private static async finalizeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.processingTasks.delete(taskId);

    if (task.status === BatchOperationStatus.RUNNING) {
      task.status = task.failed === 0 ? BatchOperationStatus.COMPLETED : BatchOperationStatus.FAILED;
    }

    task.completedAt = new Date();
    task.progress = 100;

    await cache.set(`batch:task:${taskId}`, JSON.stringify(task), 3600);

    console.log(`[Batch] 任务完成: ${taskId}, 成功: ${task.succeeded}, 失败: ${task.failed}`);

    // 发送完成通知
    // if (task.notify) {
    //   sendNotification(task.userId, { ... });
    // }
  }

  /**
   * 获取所有活动任务
   */
  static async getActiveTasks(userId?: string): Promise<BatchOperationTask[]> {
    const tasks = Array.from(this.tasks.values())
      .filter(task => task.status === BatchOperationStatus.RUNNING || task.status === BatchOperationStatus.PENDING);

    if (userId) {
      return tasks.filter(task => task.userId === userId);
    }

    return tasks;
  }

  /**
   * 清理已完成任务
   */
  static async cleanupCompletedTasks(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (
        task.completedAt &&
        task.completedAt < cutoff &&
        (task.status === BatchOperationStatus.COMPLETED || task.status === BatchOperationStatus.FAILED)
      ) {
        this.tasks.delete(taskId);
        await cache.del(`batch:task:${taskId}`);
        cleaned++;
      }
    }

    console.log(`[Batch] 清理了 ${cleaned} 个已完成任务`);
    return cleaned;
  }
}

// ============================================
// 导出
// ============================================

export default BatchOperationService;

/**
 * 审计日志服务类
 * 记录和查询所有系统关键操作
 */

import { db } from '@/db/index';
import { auditLogs, AuditActionType as _AuditActionType, AuditAction } from '@/lib/db/schema/audit-logs';
import { users } from '@/lib/db/schema/users';
import { eq, and, or as _or, gte, lte, inArray, desc, sql as _sql, count } from 'drizzle-orm';
import { cache as _cache } from '@/lib/cache';
import type { AuditLogCreate, AuditLogQuery, AuditLogStats } from '@/lib/db/schema/audit-logs';

// ============================================
// 审计日志服务类
// ============================================

export class AuditLogService {
  /**
   * 记录审计日志
   */
  static async log(data: AuditLogCreate): Promise<string> {
    try {
      const [log] = await db.insert(auditLogs).values({
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        details: data.details || {},
        ip: data.ip,
        userAgent: data.userAgent,
        success: data.success === undefined ? 'true' : (data.success ? 'true' : 'false'),
        errorMessage: data.errorMessage,
        duration: data.duration?.toString(),
        metadata: data.metadata || {},
      }).returning();

      console.log(`[Audit] ${data.action} - User: ${data.userId} - Success: ${data.success}`);
      return log.id;
    } catch (error) {
      console.error('[Audit] 记录日志失败:', error);
      throw error;
    }
  }

  /**
   * 查询审计日志
   */
  static async query(query: AuditLogQuery): Promise<{
    logs: any[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    try {
      const {
        userId,
        action,
        resourceType,
        resourceId,
        success,
        startDate,
        endDate,
        page = 1,
        pageSize = 20,
      } = query;

      const conditions = [];

      if (userId) {
        conditions.push(eq(auditLogs.userId, userId));
      }

      if (action) {
        if (Array.isArray(action)) {
          conditions.push(inArray(auditLogs.action, action));
        } else {
          conditions.push(eq(auditLogs.action, action));
        }
      }

      if (resourceType) {
        conditions.push(eq(auditLogs.resourceType, resourceType));
      }

      if (resourceId) {
        conditions.push(eq(auditLogs.resourceId, resourceId));
      }

      if (success !== undefined) {
        conditions.push(eq(auditLogs.success, success ? 'true' : 'false'));
      }

      if (startDate) {
        conditions.push(gte(auditLogs.createdAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(auditLogs.createdAt, endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 获取总数
      const totalResult = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause);

      const total = Number(totalResult[0]?.count || 0);

      // 获取日志列表
      const logs = await db.query.auditLogs.findMany({
        where: whereClause,
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: [desc(auditLogs.createdAt)],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        logs,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('[Audit] 查询日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取审计日志统计信息
   */
  static async getStats(query: {
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<AuditLogStats> {
    try {
      const { startDate, endDate } = query;

      const conditions = [];
      if (startDate) {
        conditions.push(gte(auditLogs.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(auditLogs.createdAt, endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // 获取总数
      const totalResult = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause);

      const totalLogs = Number(totalResult[0]?.count || 0);

      // 获取成功和失败数量
      const successResult = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(and(whereClause, eq(auditLogs.success, 'true')));

      const failedResult = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(and(whereClause, eq(auditLogs.success, 'false')));

      const successLogs = Number(successResult[0]?.count || 0);
      const failedLogs = Number(failedResult[0]?.count || 0);

      // 获取各操作类型的数量
      const actionCountsResult = await db
        .select({
          action: auditLogs.action,
          count: count(),
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.action);

      const actionCounts: Record<AuditAction, number> = {} as any;
      for (const ac of actionCountsResult) {
        actionCounts[ac.action as AuditAction] = Number(ac.count);
      }

      // 获取用户活动统计
      const userActivityResult = await db
        .select({
          userId: auditLogs.userId,
          count: count(),
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.userId)
        .orderBy(desc(count()))
        .limit(10);

      const userActivity = await Promise.all(
        userActivityResult.map(async (ua) => {
          const user = await db.query.users.findFirst({
            where: eq(users.id, ua.userId),
            columns: {
              id: true,
              username: true,
              email: true,
            },
          });

          return {
            userId: ua.userId,
            userName: user?.username || user?.email || 'Unknown',
            actionCount: Number(ua.count),
          };
        })
      );

      // 获取资源类型统计
      const resourceTypeCountsResult = await db
        .select({
          resourceType: auditLogs.resourceType,
          count: count(),
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.resourceType);

      const resourceTypeCounts: Record<string, number> = {};
      for (const rtc of resourceTypeCountsResult) {
        if (rtc.resourceType) {
          resourceTypeCounts[rtc.resourceType] = Number(rtc.count);
        }
      }

      return {
        totalLogs,
        successLogs,
        failedLogs,
        actionCounts,
        userActivity,
        resourceTypeCounts,
      };
    } catch (error) {
      console.error('[Audit] 获取统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 删除旧日志（数据归档）
   */
  static async deleteOldLogs(beforeDate: Date): Promise<number> {
    try {
      const result = await db
        .delete(auditLogs)
        .where(lte(auditLogs.createdAt, beforeDate))
        .returning();

      console.log(`[Audit] 删除了 ${result.length} 条旧日志`);
      return result.length;
    } catch (error) {
      console.error('[Audit] 删除旧日志失败:', error);
      throw error;
    }
  }

  /**
   * 导出审计日志（CSV格式）
   */
  static async exportToCSV(query: AuditLogQuery): Promise<string> {
    try {
      const { logs } = await this.query({ ...query, pageSize: 10000 });

      const headers = ['ID', '用户', '操作', '资源类型', '资源ID', 'IP', '成功', '错误信息', '耗时', '时间'];
      const rows = logs.map(log => [
        log.id,
        log.user?.name || log.user?.email || 'Unknown',
        log.action,
        log.resourceType || '',
        log.resourceId || '',
        log.ip || '',
        log.success,
        log.errorMessage || '',
        log.duration || '',
        log.createdAt.toISOString(),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return csvContent;
    } catch (error) {
      console.error('[Audit] 导出日志失败:', error);
      throw error;
    }
  }
}

// ============================================
// 审计日志装饰器（自动记录）
// ============================================

/**
 * 审计日志装饰器工厂
 * @param action 操作类型
 */
export function withAuditLog(action: AuditAction) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let userId = 'system';
      let success = true;
      let errorMessage: string | undefined;
      let resourceType: string | undefined;
      let resourceId: string | undefined;

      try {
        // 尝试从参数中获取userId
        if (args[0]?.userId) {
          userId = args[0].userId;
        }

        // 执行原方法
        const result = await originalMethod.apply(this, args);

        // 尝试从返回结果中提取资源信息
        if (result?.data?.id) {
          resourceId = result.data.id;
        }
        if (result?.data?.resourceType) {
          resourceType = result.data.resourceType;
        }

        return result;
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        // 记录审计日志
        const duration = Date.now() - startTime;
        try {
          await AuditLogService.log({
            userId,
            action,
            resourceType,
            resourceId,
            success,
            errorMessage,
            duration,
            metadata: {
              method: propertyKey,
              args: JSON.stringify(args).substring(0, 500), // 限制长度
            },
          });
        } catch (logError) {
          console.error('[Audit] 记录日志失败:', logError);
        }
      }
    };

    return descriptor;
  };
}

// ============================================
// 辅助函数：从请求中提取信息
// ============================================

export function extractRequestInfo(request: Request): {
  ip: string;
  userAgent: string;
} {
  // 这里的实现取决于你的请求对象结构
  // Next.js的Request对象可能需要额外的处理
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { ip, userAgent };
}

// ============================================
// 导出
// ============================================

export default AuditLogService;

/**
 * 审计日志服务
 * 记录系统操作日志，支持查询和分析
 */

import { db } from '@/db';
import { auditLogs, users as _users } from '@/db/schema';
import { eq, and, gte, lte, like, or as _or, desc, sql, inArray } from 'drizzle-orm';

// 操作类型
export type AuditAction =
  | 'login'        // 登录
  | 'logout'       // 登出
  | 'login_failed' // 登录失败
  | 'create'       // 创建
  | 'update'       // 更新
  | 'delete'       // 删除
  | 'export'       // 导出
  | 'import'       // 导入
  | 'download'     // 下载
  | 'upload'       // 上传
  | 'view'         // 查看
  | 'approve'      // 审批
  | 'reject'       // 拒绝
  | 'assign'       // 分配
  | 'revoke';      // 撤销

// 资源类型
export type AuditResource =
  | 'user'         // 用户
  | 'role'         // 角色
  | 'permission'   // 权限
  | 'department'   // 部门
  | 'project'      // 项目
  | 'document'     // 文档
  | 'auth'         // 认证
  | 'system';      // 系统

// 审计日志信息
export interface AuditLogInfo {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  resource: string;
  resourceId: number | null;
  resourceCode: string | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  responseStatus: number | null;
  errorMessage: string | null;
  duration: number | null;
  projectId: number | null;
  createdAt: Date;
}

// 创建审计日志参数
export interface CreateAuditLogParams {
  userId?: number | null;
  username?: string | null;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: number | null;
  resourceCode?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  requestParams?: object | null;
  projectId?: number | null;
  responseStatus?: number | null;
  errorMessage?: string | null;
  duration?: number | null;
}

// 查询参数
export interface AuditLogQueryParams {
  userId?: number;
  username?: string;
  action?: string | string[];
  resource?: string | string[];
  resourceId?: number;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  hasError?: boolean;
  page?: number;
  pageSize?: number;
}

// 统计结果
export interface AuditLogStats {
  total: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byUser: Array<{ userId: number; username: string; count: number }>;
  errorCount: number;
}

/**
 * 创建审计日志
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<number> {
  const [log] = await db
    .insert(auditLogs)
    .values({
      userId: params.userId || null,
      username: params.username || null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId || null,
      resourceCode: params.resourceCode || null,
      description: params.description || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      requestMethod: params.requestMethod || null,
      requestPath: params.requestPath || null,
      requestParams: params.requestParams ? JSON.stringify(params.requestParams) : null,
      projectId: params.projectId || null,
      responseStatus: params.responseStatus || null,
      errorMessage: params.errorMessage || null,
      duration: params.duration || null,
    })
    .returning({ id: auditLogs.id });

  return log.id;
}

/**
 * 批量创建审计日志
 */
export async function batchCreateAuditLogs(logs: CreateAuditLogParams[]): Promise<number> {
  const values = logs.map((params) => ({
    userId: params.userId || null,
    username: params.username || null,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId || null,
    resourceCode: params.resourceCode || null,
    description: params.description || null,
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
    requestMethod: params.requestMethod || null,
    requestPath: params.requestPath || null,
    requestParams: params.requestParams ? JSON.stringify(params.requestParams) : null,
    projectId: params.projectId || null,
    responseStatus: params.responseStatus || null,
    errorMessage: params.errorMessage || null,
    duration: params.duration || null,
  }));

  await db.insert(auditLogs).values(values);
  return logs.length;
}

/**
 * 查询审计日志
 */
export async function queryAuditLogs(
  params: AuditLogQueryParams
): Promise<{ logs: AuditLogInfo[]; total: number }> {
  const { page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const conditions: any[] = [];

  if (params.userId) {
    conditions.push(eq(auditLogs.userId, params.userId));
  }

  if (params.username) {
    conditions.push(like(auditLogs.username, `%${params.username}%`));
  }

  if (params.action) {
    if (Array.isArray(params.action)) {
      conditions.push(inArray(auditLogs.action, params.action));
    } else {
      conditions.push(eq(auditLogs.action, params.action));
    }
  }

  if (params.resource) {
    if (Array.isArray(params.resource)) {
      conditions.push(inArray(auditLogs.resource, params.resource));
    } else {
      conditions.push(eq(auditLogs.resource, params.resource));
    }
  }

  if (params.resourceId) {
    conditions.push(eq(auditLogs.resourceId, params.resourceId));
  }

  if (params.startDate) {
    conditions.push(gte(auditLogs.createdAt, params.startDate));
  }

  if (params.endDate) {
    conditions.push(lte(auditLogs.createdAt, params.endDate));
  }

  if (params.ipAddress) {
    conditions.push(eq(auditLogs.ipAddress, params.ipAddress));
  }

  if (params.hasError !== undefined) {
    if (params.hasError) {
      conditions.push(sql`${auditLogs.errorMessage} IS NOT NULL`);
    } else {
      conditions.push(sql`${auditLogs.errorMessage} IS NULL`);
    }
  }

  // 查询数据
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logsResult, countResult] = await Promise.all([
    db.query.auditLogs.findMany({
      where: whereClause,
      orderBy: [desc(auditLogs.createdAt)],
      limit: pageSize,
      offset,
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause),
  ]);

  return {
    logs: logsResult as AuditLogInfo[],
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 获取用户的操作日志
 */
export async function getUserAuditLogs(
  userId: number,
  options?: { limit?: number; actions?: AuditAction[] }
): Promise<AuditLogInfo[]> {
  const { limit = 50, actions } = options || {};

  const conditions = [eq(auditLogs.userId, userId)];

  if (actions && actions.length > 0) {
    conditions.push(inArray(auditLogs.action, actions));
  }

  const logs = await db.query.auditLogs.findMany({
    where: and(...conditions),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
  });

  return logs as AuditLogInfo[];
}

/**
 * 获取资源的操作历史
 */
export async function getResourceAuditLogs(
  resource: AuditResource,
  resourceId: number,
  options?: { limit?: number }
): Promise<AuditLogInfo[]> {
  const { limit = 50 } = options || {};

  const logs = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.resource, resource),
      eq(auditLogs.resourceId, resourceId)
    ),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
  });

  return logs as AuditLogInfo[];
}

/**
 * 获取审计日志统计
 */
export async function getAuditLogStats(
  startDate?: Date,
  endDate?: Date
): Promise<AuditLogStats> {
  const conditions: any[] = [];

  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(whereClause);

  // 按操作类型统计
  const byActionResult = await db
    .select({
      action: auditLogs.action,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(whereClause)
    .groupBy(auditLogs.action);

  // 按资源类型统计
  const byResourceResult = await db
    .select({
      resource: auditLogs.resource,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(whereClause)
    .groupBy(auditLogs.resource);

  // 按用户统计（前10名）
  const byUserResult = await db
    .select({
      userId: auditLogs.userId,
      username: auditLogs.username,
      count: sql<number>`count(*)`,
    })
    .from(auditLogs)
    .where(whereClause)
    .groupBy(auditLogs.userId, auditLogs.username)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  // 错误数统计
  const [errorResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(whereClause, sql`${auditLogs.errorMessage} IS NOT NULL`));

  return {
    total: Number(totalResult?.count || 0),
    byAction: Object.fromEntries(byActionResult.map((r) => [r.action, Number(r.count)])),
    byResource: Object.fromEntries(byResourceResult.map((r) => [r.resource, Number(r.count)])),
    byUser: byUserResult
      .filter((r) => r.userId !== null)
      .map((r) => ({
        userId: r.userId!,
        username: r.username || '未知',
        count: Number(r.count),
      })),
    errorCount: Number(errorResult?.count || 0),
  };
}

/**
 * 清理过期审计日志
 * @param daysToKeep 保留天数
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await db
    .delete(auditLogs)
    .where(lte(auditLogs.createdAt, cutoffDate));

  return result.rowCount || 0;
}

/**
 * 辅助函数：从请求中提取信息
 */
export function extractRequestInfo(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string;
  requestPath: string;
} {
  const headers = request.headers;

  // 获取IP地址（支持代理）
  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    null;

  return {
    ipAddress,
    userAgent: headers.get('user-agent'),
    requestMethod: request.method,
    requestPath: new URL(request.url).pathname,
  };
}

/**
 * 辅助函数：创建审计日志装饰器
 */
export function withAuditLog(
  action: AuditAction,
  resource: AuditResource,
  getResourceId?: (request: Request) => number | Promise<number>
) {
  return async function (
    request: Request,
    handler: (request: Request) => Promise<Response>
  ): Promise<Response> {
    const startTime = Date.now();
    const requestInfo = extractRequestInfo(request);
    let response: Response | undefined;
    let resourceId: number | undefined;
    let errorMessage: string | undefined;

    try {
      response = await handler(request);

      if (getResourceId) {
        try {
          resourceId = await getResourceId(request);
        } catch {
          // 忽略获取资源ID的错误
        }
      }

      return response;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      // 异步记录审计日志，不阻塞响应
      createAuditLog({
        action,
        resource,
        resourceId,
        responseStatus: response?.status,
        errorMessage,
        duration: Date.now() - startTime,
        ...requestInfo,
      }).catch(console.error);
    }
  };
}

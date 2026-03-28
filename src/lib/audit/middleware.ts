/**
 * 审计日志中间件
 * 提供API审计日志记录功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog, extractRequestInfo, AuditAction, AuditResource } from '@/lib/audit/service';

// 扩展的请求信息
interface AuditContext {
  userId?: number;
  username?: string;
  startTime: number;
  requestInfo: ReturnType<typeof extractRequestInfo>;
}

/**
 * 审计日志中间件工厂
 * 创建一个记录审计日志的中间件
 */
export function createAuditMiddleware(
  action: AuditAction,
  resource: AuditResource,
  options?: {
    getResourceId?: (request: NextRequest, body?: any) => number | Promise<number>;
    getResourceCode?: (request: NextRequest, body?: any) => string | Promise<string>;
    getDescription?: (request: NextRequest, body?: any, response?: any) => string;
    skipCondition?: (request: NextRequest) => boolean;
  }
) {
  return async (
    request: NextRequest,
    handler: (request: NextRequest, context?: AuditContext) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestInfo = extractRequestInfo(request);
    
    // 检查是否跳过审计日志
    if (options?.skipCondition?.(request)) {
      return handler(request);
    }

    // 解析请求体（用于获取资源ID等）
    let body: any = null;
    try {
      if (request.method !== 'GET') {
        const clonedRequest = request.clone();
        body = await clonedRequest.json();
      }
    } catch {
      // 忽略解析错误
    }

    let response: NextResponse | undefined;
    let errorMessage: string | undefined;

    try {
      // 执行实际处理器
      response = await handler(request, { startTime, requestInfo });

      return response;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      // 异步记录审计日志，不阻塞响应
      (async () => {
        try {
          // 获取资源ID和代码
          let resourceId: number | undefined;
          let resourceCode: string | undefined;

          if (options?.getResourceId) {
            resourceId = await options.getResourceId(request, body);
          }

          if (options?.getResourceCode) {
            resourceCode = await options.getResourceCode(request, body);
          }

          // 获取描述
          let description: string | undefined;
          if (options?.getDescription) {
            description = options.getDescription(request, body, response);
          }

          // 从响应中获取用户信息（如果处理器设置了）
          const context = (request as any).__auditContext as AuditContext | undefined;

          await createAuditLog({
            userId: context?.userId,
            username: context?.username,
            action,
            resource,
            resourceId,
            resourceCode,
            description,
            responseStatus: response?.status,
            errorMessage,
            duration: Date.now() - startTime,
            ...requestInfo,
          });
        } catch (err) {
          console.error('Failed to create audit log:', err);
        }
      })();
    }
  };
}

/**
 * 预定义的审计中间件
 */
export const auditMiddlewares = {
  // 登录审计
  login: createAuditMiddleware('login', 'auth', {
    getDescription: (req, body) => `用户 ${body?.username} 尝试登录`,
  }),

  // 登出审计
  logout: createAuditMiddleware('logout', 'auth', {
    getDescription: () => '用户登出',
  }),

  // 用户创建审计
  createUser: createAuditMiddleware('create', 'user', {
    getDescription: (req, body) => `创建用户: ${body?.username}`,
    getResourceCode: (req, body) => body?.username,
  }),

  // 用户更新审计
  updateUser: createAuditMiddleware('update', 'user', {
    getResourceId: (req) => {
      const match = req.url.match(/\/api\/users\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    },
    getDescription: (req, body) => `更新用户信息`,
  }),

  // 用户删除审计
  deleteUser: createAuditMiddleware('delete', 'user', {
    getResourceId: (req) => {
      const match = req.url.match(/\/api\/users\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    },
    getDescription: () => `删除用户`,
  }),

  // 角色创建审计
  createRole: createAuditMiddleware('create', 'role', {
    getDescription: (req, body) => `创建角色: ${body?.name}`,
    getResourceCode: (req, body) => body?.code,
  }),

  // 角色更新审计
  updateRole: createAuditMiddleware('update', 'role', {
    getResourceId: (req) => {
      const match = req.url.match(/\/api\/roles\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    },
  }),

  // 角色权限变更审计
  updateRolePermissions: createAuditMiddleware('update', 'permission', {
    getResourceId: (req) => {
      const match = req.url.match(/\/api\/roles\/(\d+)\/permissions/);
      return match ? parseInt(match[1]) : 0;
    },
    getDescription: () => `更新角色权限`,
  }),

  // 项目成员添加审计
  addProjectMember: createAuditMiddleware('assign', 'project', {
    getResourceId: (req) => {
      const match = req.url.match(/\/api\/projects\/(\d+)\/members/);
      return match ? parseInt(match[1]) : 0;
    },
    getDescription: () => `添加项目成员`,
  }),

  // 文档导出审计
  exportDocument: createAuditMiddleware('export', 'document', {
    getDescription: (req, body) => `导出文档`,
  }),

  // 文档下载审计
  downloadDocument: createAuditMiddleware('download', 'document', {
    getDescription: (req, body) => `下载文档`,
  }),
};

/**
 * 在请求中设置审计上下文（用于传递用户信息）
 */
export function setAuditContext(
  request: NextRequest,
  context: Partial<AuditContext>
): void {
  (request as any).__auditContext = {
    ...((request as any).__auditContext || {}),
    ...context,
    startTime: (request as any).__auditContext?.startTime || Date.now(),
    requestInfo: (request as any).__auditContext?.requestInfo || extractRequestInfo(request),
  };
}

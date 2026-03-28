/**
 * 项目级权限中间件
 * 用于验证用户在特定项目中的访问权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from './middleware';
import { hasProjectPermission, getProjectMemberPermission } from '@/lib/project/member';
import { canAccessDocument, getUserMaxSecurityLevel } from '@/lib/document/security';
import { SecurityLevel } from '@/lib/document/security';

/**
 * 项目权限中间件
 * 验证用户是否有项目的指定权限
 * @param projectId 项目ID（可以从路径参数或请求体获取）
 * @param permission 权限类型：view/edit/audit/export
 */
export async function withProjectPermission(
  request: NextRequest,
  projectId: number,
  permission: 'view' | 'edit' | 'audit' | 'export',
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    const hasAccess = await hasProjectPermission(projectId, userId, permission);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: '无权访问此项目',
          projectId,
          requiredPermission: permission,
        },
        { status: 403 }
      );
    }

    return handler(req, userId);
  });
}

/**
 * 项目成员中间件
 * 验证用户是否是项目成员（包括项目负责人）
 */
export async function withProjectMember(
  request: NextRequest,
  projectId: number,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    const permissions = await getProjectMemberPermission(projectId, userId);

    if (!permissions) {
      return NextResponse.json(
        {
          error: '您不是此项目的成员',
          projectId,
        },
        { status: 403 }
      );
    }

    return handler(req, userId);
  });
}

/**
 * 项目管理员中间件
 * 验证用户是否是项目负责人（owner）或编辑者（editor）
 */
export async function withProjectAdmin(
  request: NextRequest,
  projectId: number,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    const permissions = await getProjectMemberPermission(projectId, userId);

    if (!permissions || (!permissions.canEdit && permissions.maxSecurityLevel !== 'secret')) {
      return NextResponse.json(
        {
          error: '需要项目管理员权限',
          projectId,
        },
        { status: 403 }
      );
    }

    return handler(req, userId);
  });
}

/**
 * 文档密级访问中间件
 * 验证用户是否可以访问指定密级的文档
 */
export async function withDocumentAccess(
  request: NextRequest,
  projectId: number,
  documentLevel: SecurityLevel,
  handler: (request: NextRequest, userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, userId) => {
    const canAccess = await canAccessDocument(projectId, userId, documentLevel);

    if (!canAccess) {
      return NextResponse.json(
        {
          error: '无权访问此密级的文档',
          projectId,
          documentLevel,
        },
        { status: 403 }
      );
    }

    return handler(req, userId);
  });
}

/**
 * 动态项目权限中间件
 * 从请求路径或请求体中提取项目ID
 */
export function createProjectPermissionMiddleware(
  permission: 'view' | 'edit' | 'audit' | 'export',
  getProjectId: (request: NextRequest) => number | Promise<number>
) {
  return async (
    request: NextRequest,
    handler: (request: NextRequest, userId: number) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    return withAuth(request, async (req, userId) => {
      const projectId = await getProjectId(request);
      const hasAccess = await hasProjectPermission(projectId, userId, permission);

      if (!hasAccess) {
        return NextResponse.json(
          {
            error: '无权访问此项目',
            projectId,
            requiredPermission: permission,
          },
          { status: 403 }
        );
      }

      return handler(req, userId);
    });
  };
}

/**
 * 从路径参数获取项目ID的工具函数
 */
export function getProjectIdFromPath(request: NextRequest): number {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const projectsIndex = pathParts.findIndex((part) => part === 'projects');

  if (projectsIndex !== -1 && pathParts[projectsIndex + 1]) {
    return parseInt(pathParts[projectsIndex + 1]);
  }

  throw new Error('无法从路径中提取项目ID');
}

/**
 * 从请求体获取项目ID的工具函数
 */
export async function getProjectIdFromBody(request: NextRequest): Promise<number> {
  try {
    const body = await request.clone().json();
    return body.projectId;
  } catch {
    throw new Error('无法从请求体中提取项目ID');
  }
}

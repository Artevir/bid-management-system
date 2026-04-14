/**
 * 项目权限检查API
 * GET: 检查用户在项目中的权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getProjectMemberPermission, hasProjectPermission } from '@/lib/project/member';
import { success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取用户在项目中的权限
async function getPermission(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action'); // view/edit/audit/export

  if (action) {
    // 检查特定权限
    const hasAccess = await hasProjectPermission(projectId, userId, action as 'view' | 'edit' | 'audit' | 'export');
    return success({
      projectId,
      action,
      hasPermission: hasAccess,
    });
  }

  // 获取完整权限信息
  const permissions = await getProjectMemberPermission(projectId, userId);
  return success({
    projectId,
    isMember: Boolean(permissions),
    permissions: permissions || null,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withAuth(request, (req, userId) => getPermission(req, userId, projectId));
}

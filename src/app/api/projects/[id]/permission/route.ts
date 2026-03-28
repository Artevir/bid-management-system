/**
 * 项目权限检查API
 * GET: 检查用户在项目中的权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getProjectMemberPermission, hasProjectPermission } from '@/lib/project/member';

// 获取用户在项目中的权限
async function getPermission(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // view/edit/audit/export

    if (action) {
      // 检查特定权限
      const hasAccess = await hasProjectPermission(projectId, userId, action as 'view' | 'edit' | 'audit' | 'export');
      return NextResponse.json({
        projectId,
        action,
        hasPermission: hasAccess,
      });
    }

    // 获取完整权限信息
    const permissions = await getProjectMemberPermission(projectId, userId);

    if (!permissions) {
      return NextResponse.json({
        projectId,
        isMember: false,
        permissions: null,
      });
    }

    return NextResponse.json({
      projectId,
      isMember: true,
      permissions,
    });
  } catch (error) {
    console.error('Get project permission error:', error);
    return NextResponse.json({ error: '获取项目权限失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getPermission(req, userId, parseInt(id)));
}

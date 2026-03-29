/**
 * 项目成员管理API
 * GET: 获取项目成员列表
 * POST: 添加项目成员
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth as _withAuth, withPermission } from '@/lib/auth/middleware';
import {
  getProjectMembers,
  addProjectMember as _addProjectMember,
  batchAddProjectMembers,
  ProjectRole,
} from '@/lib/project/member';

// 获取项目成员列表
async function getMembers(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    const members = await getProjectMembers(projectId);

    return NextResponse.json({
      projectId,
      members,
      total: members.length,
    });
  } catch (error) {
    console.error('Get project members error:', error);
    return NextResponse.json({ error: '获取项目成员失败' }, { status: 500 });
  }
}

// 添加项目成员
async function addMember(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { userIds, role, permissions } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: '请选择要添加的成员' }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ error: '请指定成员角色' }, { status: 400 });
    }

    // 批量添加成员
    const members = userIds.map((uid: number) => ({
      userId: uid,
      role: role as ProjectRole,
      permissions,
    }));

    const count = await batchAddProjectMembers(projectId, members, userId);

    return NextResponse.json(
      {
        success: true,
        message: `成功添加 ${count} 名成员`,
        addedCount: count,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add project member error:', error);
    return NextResponse.json({ error: '添加项目成员失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // 需要 project:read 权限
  return withPermission(request, 'project:read', (req, userId) =>
    getMembers(req, userId, parseInt(id))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // 需要 project:manage 权限
  return withPermission(request, 'project:manage', (req, userId) =>
    addMember(req, userId, parseInt(id))
  );
}

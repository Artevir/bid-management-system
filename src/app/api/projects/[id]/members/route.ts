/**
 * 项目成员管理API
 * GET: 获取项目成员列表
 * POST: 添加项目成员
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import {
  getProjectMembers,
  batchAddProjectMembers,
  ProjectRole,
} from '@/lib/project/member';
import { AppError, created, success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取项目成员列表
async function getMembers(
  _request: NextRequest,
  _userId: number,
  projectId: number
): Promise<NextResponse> {
  const members = await getProjectMembers(projectId);
  return success({
    projectId,
    members,
    total: members.length,
  });
}

// 添加项目成员
async function addMember(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { userIds, role, permissions } = body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw AppError.badRequest('请选择要添加的成员');
  }

  if (!role) {
    throw AppError.badRequest('请指定成员角色');
  }

  // 批量添加成员
  const members = userIds.map((uid: number) => ({
    userId: uid,
    role: role as ProjectRole,
    permissions,
  }));

  const count = await batchAddProjectMembers(projectId, members, userId);

  return created({ addedCount: count }, `成功添加 ${count} 名成员`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  // 需要 project:read 权限
  return withPermission(request, 'project:read', (req, userId) =>
    getMembers(req, userId, projectId)
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  // 需要 project:manage 权限
  return withPermission(request, 'project:manage', (req, userId) =>
    addMember(req, userId, projectId)
  );
}

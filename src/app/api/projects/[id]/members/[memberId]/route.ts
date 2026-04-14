/**
 * 单个项目成员操作API
 * GET: 获取成员详情
 * PUT: 更新成员权限
 * DELETE: 移除成员
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import {
  getProjectMember,
  updateProjectMemberPermission,
  removeProjectMember,
  ProjectMemberPermission,
} from '@/lib/project/member';
import { AppError, success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取成员详情
async function getMember(
  _request: NextRequest,
  _currentUserId: number,
  projectId: number,
  memberId: number
): Promise<NextResponse> {
  const member = await getProjectMember(projectId, memberId);
  if (!member) {
    throw AppError.notFound('成员');
  }
  return success({ member });
}

// 更新成员权限
async function updateMember(
  request: NextRequest,
  _currentUserId: number,
  projectId: number,
  memberId: number
): Promise<NextResponse> {
  const body = await request.json();
  const { role, canView, canEdit, canAudit, canExport, maxSecurityLevel } = body;

  const permissions: Partial<ProjectMemberPermission> = {};
  if (canView !== undefined) permissions.canView = canView;
  if (canEdit !== undefined) permissions.canEdit = canEdit;
  if (canAudit !== undefined) permissions.canAudit = canAudit;
  if (canExport !== undefined) permissions.canExport = canExport;
  if (maxSecurityLevel) permissions.maxSecurityLevel = maxSecurityLevel;

  // 更新角色
  if (role) {
    // 根据角色设置默认权限
    permissions.canEdit = role === 'editor' || role === 'owner';
    permissions.canAudit = role === 'auditor' || role === 'owner';
    permissions.canExport = role === 'owner';
  }

  const member = await updateProjectMemberPermission(projectId, memberId, permissions);

  if (!member) {
    throw AppError.notFound('成员');
  }

  return success({ member }, '成员权限更新成功');
}

// 移除成员
async function deleteMember(
  _request: NextRequest,
  _currentUserId: number,
  projectId: number,
  memberId: number
): Promise<NextResponse> {
  const removed = await removeProjectMember(projectId, memberId);

  if (!removed) {
    throw AppError.badRequest('无法移除项目负责人');
  }

  return success({ memberId }, '成员已移除');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const projectId = parseResourceId(id, '项目');
  const targetMemberId = parseResourceId(memberId, '成员');
  return withPermission(request, 'project:read', (req, userId) =>
    getMember(req, userId, projectId, targetMemberId)
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const projectId = parseResourceId(id, '项目');
  const targetMemberId = parseResourceId(memberId, '成员');
  return withPermission(request, 'project:manage', (req, userId) =>
    updateMember(req, userId, projectId, targetMemberId)
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  const projectId = parseResourceId(id, '项目');
  const targetMemberId = parseResourceId(memberId, '成员');
  return withPermission(request, 'project:manage', (req, userId) =>
    deleteMember(req, userId, projectId, targetMemberId)
  );
}

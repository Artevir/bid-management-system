/**
 * 单个项目成员操作API
 * GET: 获取成员详情
 * PUT: 更新成员权限
 * DELETE: 移除成员
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth as _withAuth, withPermission } from '@/lib/auth/middleware';
import {
  getProjectMember,
  updateProjectMemberPermission,
  removeProjectMember,
  ProjectMemberPermission,
} from '@/lib/project/member';

// 获取成员详情
async function getMember(
  request: NextRequest,
  currentUserId: number,
  projectId: number,
  memberId: number
): Promise<NextResponse> {
  try {
    const member = await getProjectMember(projectId, memberId);

    if (!member) {
      return NextResponse.json({ error: '成员不存在' }, { status: 404 });
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Get member error:', error);
    return NextResponse.json({ error: '获取成员信息失败' }, { status: 500 });
  }
}

// 更新成员权限
async function updateMember(
  request: NextRequest,
  currentUserId: number,
  projectId: number,
  memberId: number
): Promise<NextResponse> {
  try {
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
      return NextResponse.json({ error: '成员不存在' }, { status: 404 });
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: '更新成员权限失败' }, { status: 500 });
  }
}

// 移除成员
async function deleteMember(
  request: NextRequest,
  currentUserId: number,
  projectId: number,
  memberId: number
): Promise<NextResponse> {
  try {
    const success = await removeProjectMember(projectId, memberId);

    if (!success) {
      return NextResponse.json({ error: '无法移除项目负责人' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: '成员已移除' });
  } catch (error) {
    console.error('Delete member error:', error);
    return NextResponse.json({ error: '移除成员失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  return withPermission(request, 'project:read', (req, userId) =>
    getMember(req, userId, parseInt(id), parseInt(memberId))
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  return withPermission(request, 'project:manage', (req, userId) =>
    updateMember(req, userId, parseInt(id), parseInt(memberId))
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;
  return withPermission(request, 'project:manage', (req, userId) =>
    deleteMember(req, userId, parseInt(id), parseInt(memberId))
  );
}

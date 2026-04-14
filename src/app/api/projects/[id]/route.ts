/**
 * 项目详情API
 * GET: 获取项目详情
 * PUT: 更新项目
 * DELETE: 删除项目
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withPermission } from '@/lib/auth/middleware';
import {
  getProjectById,
  updateProject,
  deleteProject,
  UpdateProjectData,
} from '@/lib/project/service';
import { AppError, success } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取项目详情
async function getDetail(
  _request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  const project = await getProjectById(projectId, userId);
  if (!project) {
    throw AppError.notFound('项目');
  }
  return success(project);
}

// 更新项目
async function update(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  const body = await request.json();

  // 处理日期字段
  const dateFields = [
    'publishDate',
    'registerDeadline',
    'questionDeadline',
    'submissionDeadline',
    'openBidDate',
  ];

  const data: UpdateProjectData = { ...body };

  for (const field of dateFields) {
    if (body[field]) {
      data[field as keyof UpdateProjectData] = new Date(body[field]) as any;
    } else if (body[field] === null || body[field] === '') {
      data[field as keyof UpdateProjectData] = null as any;
    }
  }

  await updateProject(projectId, data, userId);
  return success({ projectId }, '项目更新成功');
}

// 删除项目
async function remove(
  _request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  await deleteProject(projectId, userId);
  return success({ projectId }, '项目已删除');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withAuth(request, (req, userId) => getDetail(req, userId, projectId));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withPermission(request, 'project:update', (req, userId) =>
    update(req, userId, projectId)
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseResourceId(id, '项目');
  return withPermission(request, 'project:delete', (req, userId) =>
    remove(req, userId, projectId)
  );
}

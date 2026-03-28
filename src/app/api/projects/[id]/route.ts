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

// 获取项目详情
async function getDetail(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    const project = await getProjectById(projectId, userId);

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Get project detail error:', error);
    return NextResponse.json({ error: '获取项目详情失败' }, { status: 500 });
  }
}

// 更新项目
async function update(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
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

    return NextResponse.json({
      success: true,
      message: '项目更新成功',
    });
  } catch (error) {
    console.error('Update project error:', error);
    const message = error instanceof Error ? error.message : '更新项目失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// 删除项目
async function remove(
  request: NextRequest,
  userId: number,
  projectId: number
): Promise<NextResponse> {
  try {
    await deleteProject(projectId, userId);

    return NextResponse.json({
      success: true,
      message: '项目已归档',
    });
  } catch (error) {
    console.error('Delete project error:', error);
    const message = error instanceof Error ? error.message : '删除项目失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getDetail(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withPermission(request, 'project:update', (req, userId) =>
    update(req, userId, parseInt(id))
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withPermission(request, 'project:delete', (req, userId) =>
    remove(req, userId, parseInt(id))
  );
}

/**
 * 过程记录API - 项目任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  getUserTasks,
} from '@/lib/project/process';

async function listTasks(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const parentId = searchParams.get('parentId');
    const scope = searchParams.get('scope'); // 'user' | 'project'

    if (scope === 'user') {
      const status = searchParams.get('status') || undefined;
      const tasks = await getUserTasks(userId, status);
      return NextResponse.json({ tasks });
    }

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const tasks = await getProjectTasks(
      parseInt(projectId),
      parentId ? parseInt(parentId) : undefined
    );

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Get project tasks error:', error);
    return NextResponse.json({ error: '获取项目任务失败' }, { status: 500 });
  }
}

async function createTask(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      projectId,
      phaseId,
      title,
      description,
      assigneeId,
      priority,
      dueDate,
      parentId,
      sortOrder,
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const task = await createProjectTask({
      projectId,
      phaseId,
      title,
      description,
      assigneeId,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      parentId,
      sortOrder,
      createdBy: userId,
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Create project task error:', error);
    return NextResponse.json({ error: '创建项目任务失败' }, { status: 500 });
  }
}

async function updateTask(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, ...params } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    if (params.dueDate) {
      params.dueDate = new Date(params.dueDate);
    }

    await updateProjectTask(id, params);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update project task error:', error);
    return NextResponse.json({ error: '更新项目任务失败' }, { status: 500 });
  }
}

async function deleteTask(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    await deleteProjectTask(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project task error:', error);
    return NextResponse.json({ error: '删除项目任务失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => listTasks(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createTask(req, userId));
}

export async function PUT(request: NextRequest) {
  return withAuth(request, (req, userId) => updateTask(req, userId));
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, (req, userId) => deleteTask(req, userId));
}

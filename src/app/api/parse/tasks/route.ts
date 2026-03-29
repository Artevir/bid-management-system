/**
 * 解析任务API
 * GET: 获取解析任务列表
 * POST: 创建解析任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withPermission } from '@/lib/auth/middleware';
import {
  getProjectParseTasks,
  createParseTask,
  CreateParseTaskParams,
} from '@/lib/parse/service';

// 获取解析任务列表
async function getTasks(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const tasks = await getProjectParseTasks(parseInt(projectId));

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Get parse tasks error:', error);
    return NextResponse.json({ error: '获取解析任务列表失败' }, { status: 500 });
  }
}

// 创建解析任务
async function createTask(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    if (!body.projectId || !body.fileId) {
      return NextResponse.json({ error: '缺少项目ID或文件ID' }, { status: 400 });
    }

    const params: CreateParseTaskParams = {
      projectId: body.projectId,
      fileId: body.fileId,
      type: body.type || 'full',
      userId,
    };

    const taskId = await createParseTask(params);

    return NextResponse.json(
      {
        success: true,
        message: '解析任务创建成功',
        taskId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create parse task error:', error);
    return NextResponse.json({ error: '创建解析任务失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getTasks);
}

export async function POST(request: NextRequest) {
  return withPermission(request, 'parse:create', createTask);
}

/**
 * 待办事项API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getTodos,
  createTodo,
  updateTodoStatus as _updateTodoStatus,
  deleteTodo as _deleteTodo,
} from '@/lib/authorization/service';

// GET - 获取待办事项列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const todos = await getTodos(applicationId);

    return NextResponse.json(todos);
  } catch (error) {
    console.error('获取待办事项列表失败:', error);
    return NextResponse.json({ error: '获取待办事项列表失败' }, { status: 500 });
  }
}

// POST - 创建待办事项
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const body = await req.json();

    const todo = await createTodo({
      applicationId,
      title: body.title,
      assigneeId: body.assigneeId || session.user.id,
      assigneeName: body.assigneeName || session.user.username,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      status: body.status,
      notes: body.notes,
      type: body.type,
    });

    return NextResponse.json(todo);
  } catch (error) {
    console.error('创建待办事项失败:', error);
    return NextResponse.json({ error: '创建待办事项失败' }, { status: 500 });
  }
}

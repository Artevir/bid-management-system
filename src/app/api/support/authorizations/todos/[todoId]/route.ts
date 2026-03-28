/**
 * 单个待办事项API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  updateTodoStatus,
  deleteTodo,
} from '@/lib/authorization/service';

// PUT - 更新待办事项
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { todoId } = await params;
    const id = parseInt(todoId);
    const body = await req.json();

    const todo = await updateTodoStatus(id, body.status, body.notes);

    return NextResponse.json(todo);
  } catch (error) {
    console.error('更新待办事项失败:', error);
    return NextResponse.json({ error: '更新待办事项失败' }, { status: 500 });
  }
}

// DELETE - 删除待办事项
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { todoId } = await params;
    const id = parseInt(todoId);

    await deleteTodo(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除待办事项失败:', error);
    return NextResponse.json({ error: '删除待办事项失败' }, { status: 500 });
  }
}

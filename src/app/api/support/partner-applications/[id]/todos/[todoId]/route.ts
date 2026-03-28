/**
 * 单个待办事项API路由
 * PUT /api/support/partner-applications/[id]/todos/[todoId] - 更新待办事项
 * DELETE /api/support/partner-applications/[id]/todos/[todoId] - 删除待办事项
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  updatePartnerTodo,
  deletePartnerTodo,
} from '@/lib/partner-application/service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; todoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { todoId } = await params;
    const id = parseInt(todoId);
    const body = await req.json();

    const todo = await updatePartnerTodo(id, {
      status: body.status,
      notes: body.notes,
    });

    return NextResponse.json(todo);
  } catch (error) {
    console.error('更新友司待办事项失败:', error);
    return NextResponse.json({ error: '更新友司待办事项失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; todoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { todoId } = await params;
    const id = parseInt(todoId);

    await deletePartnerTodo(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除友司待办事项失败:', error);
    return NextResponse.json({ error: '删除友司待办事项失败' }, { status: 500 });
  }
}

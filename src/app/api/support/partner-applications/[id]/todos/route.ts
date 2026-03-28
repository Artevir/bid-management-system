/**
 * 友司待办事项API路由
 * GET /api/support/partner-applications/[id]/todos - 获取待办列表
 * POST /api/support/partner-applications/[id]/todos - 创建待办事项
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getPartnerTodos,
  createPartnerTodo,
} from '@/lib/partner-application/service';

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

    const todos = await getPartnerTodos(applicationId);
    return NextResponse.json(todos);
  } catch (error) {
    console.error('获取友司待办事项失败:', error);
    return NextResponse.json({ error: '获取友司待办事项失败' }, { status: 500 });
  }
}

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

    const todo = await createPartnerTodo({
      applicationId,
      title: body.title,
      assigneeId: body.assigneeId || session.user.id,
      assigneeName: body.assigneeName || session.user.username,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      type: body.type,
      notes: body.notes,
    });

    return NextResponse.json(todo);
  } catch (error) {
    console.error('创建友司待办事项失败:', error);
    return NextResponse.json({ error: '创建友司待办事项失败' }, { status: 500 });
  }
}

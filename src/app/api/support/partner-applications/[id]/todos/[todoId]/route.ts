/**
 * 单个待办事项API路由
 * PUT /api/support/partner-applications/[id]/todos/[todoId] - 更新待办事项
 * DELETE /api/support/partner-applications/[id]/todos/[todoId] - 删除待办事项
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { updatePartnerTodo, deletePartnerTodo } from '@/lib/partner-application/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  assertPartnerTodoBelongs,
  canAccessPartnerApplication,
} from '@/lib/support/application-access';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; todoId: string }> }
) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const todoId = parseIdFromParams(p, 'todoId', '待办');

      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertPartnerTodoBelongs(applicationId, todoId);
      if (!belongs) {
        return NextResponse.json({ error: '待办不属于该申请' }, { status: 400 });
      }

      const body = await request.json();

      const todo = await updatePartnerTodo(todoId, {
        status: body.status,
        notes: body.notes,
      });

      return NextResponse.json(todo);
    } catch (error) {
      console.error('更新友司待办事项失败:', error);
      return NextResponse.json({ error: '更新友司待办事项失败' }, { status: 500 });
    }
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; todoId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const todoId = parseIdFromParams(p, 'todoId', '待办');

      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertPartnerTodoBelongs(applicationId, todoId);
      if (!belongs) {
        return NextResponse.json({ error: '待办不属于该申请' }, { status: 400 });
      }

      await deletePartnerTodo(todoId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除友司待办事项失败:', error);
      return NextResponse.json({ error: '删除友司待办事项失败' }, { status: 500 });
    }
  });
}

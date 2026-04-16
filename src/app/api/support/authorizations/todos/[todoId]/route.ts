/**
 * 单个待办事项API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { updateTodoStatus, deleteTodo } from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  canAccessAuthorizationApplication,
  getAuthorizationTodoApplicationId,
} from '@/lib/support/application-access';

// PUT - 更新待办事项
export async function PUT(req: NextRequest, { params }: { params: Promise<{ todoId: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const todoId = parseIdFromParams(p, 'todoId', '待办');
      const applicationId = await getAuthorizationTodoApplicationId(todoId);
      if (!applicationId) {
        return NextResponse.json({ error: '待办不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists || !permission.allowed) {
        return NextResponse.json({ error: '无权修改该待办' }, { status: 403 });
      }

      const body = await request.json();

      const todo = await updateTodoStatus(todoId, body.status, body.notes);

      return NextResponse.json(todo);
    } catch (error) {
      console.error('更新待办事项失败:', error);
      return NextResponse.json({ error: '更新待办事项失败' }, { status: 500 });
    }
  });
}

// DELETE - 删除待办事项
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const todoId = parseIdFromParams(p, 'todoId', '待办');
      const applicationId = await getAuthorizationTodoApplicationId(todoId);
      if (!applicationId) {
        return NextResponse.json({ error: '待办不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists || !permission.allowed) {
        return NextResponse.json({ error: '无权删除该待办' }, { status: 403 });
      }

      await deleteTodo(todoId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除待办事项失败:', error);
      return NextResponse.json({ error: '删除待办事项失败' }, { status: 500 });
    }
  });
}

/**
 * 待办事项API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getTodos,
  createTodo,
  updateTodoStatus as _updateTodoStatus,
  deleteTodo as _deleteTodo,
} from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import { canAccessAuthorizationApplication } from '@/lib/support/application-access';

// GET - 获取待办事项列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const todos = await getTodos(applicationId);
      return NextResponse.json(todos);
    } catch (error) {
      console.error('获取待办事项列表失败:', error);
      return NextResponse.json({ error: '获取待办事项列表失败' }, { status: 500 });
    }
  });
}

// POST - 创建待办事项
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const body = await request.json();

      const todo = await createTodo({
        applicationId,
        title: body.title,
        assigneeId: body.assigneeId || userId,
        assigneeName: body.assigneeName || `用户${userId}`,
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
  });
}

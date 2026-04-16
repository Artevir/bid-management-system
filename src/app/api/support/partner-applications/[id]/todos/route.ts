/**
 * 友司待办事项API路由
 * GET /api/support/partner-applications/[id]/todos - 获取待办列表
 * POST /api/support/partner-applications/[id]/todos - 创建待办事项
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getPartnerTodos, createPartnerTodo } from '@/lib/partner-application/service';
import { parseIdFromParams } from '@/lib/api/validators';
import { canAccessPartnerApplication } from '@/lib/support/application-access';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const permission = await canAccessPartnerApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const todos = await getPartnerTodos(applicationId);
      return NextResponse.json(todos);
    } catch (error) {
      console.error('获取友司待办事项失败:', error);
      return NextResponse.json({ error: '获取友司待办事项失败' }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const body = await request.json();

      const todo = await createPartnerTodo({
        applicationId,
        title: body.title,
        assigneeId: body.assigneeId || userId,
        assigneeName: body.assigneeName || `用户${userId}`,
        deadline: body.deadline ? new Date(body.deadline) : undefined,
        type: body.type,
        notes: body.notes,
      });

      return NextResponse.json(todo);
    } catch (error) {
      console.error('创建友司待办事项失败:', error);
      return NextResponse.json({ error: '创建友司待办事项失败' }, { status: 500 });
    }
  });
}

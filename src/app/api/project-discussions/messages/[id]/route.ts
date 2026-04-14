import { NextRequest, NextResponse } from 'next/server';
import {
  getMessageById,
  editMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
  checkDiscussionPermission,
} from '@/lib/project-discussion/service';
import { checkProjectPermission } from '@/lib/project-org/service';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { projectDiscussions } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function resolveProjectIdFromMessage(messageDiscussionId: number): Promise<number | null> {
  const [discussion] = await db
    .select({ projectId: projectDiscussions.projectId })
    .from(projectDiscussions)
    .where(eq(projectDiscussions.id, messageDiscussionId))
    .limit(1);
  return discussion?.projectId ?? null;
}

// GET /api/project-discussions/messages/[id] - 获取消息详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (_req, userId) => {
    try {
      const { id } = await params;
      const messageId = Number.parseInt(id, 10);
      if (!Number.isFinite(messageId) || messageId <= 0) {
        return NextResponse.json({ error: '无效的消息ID' }, { status: 400 });
      }

      const message = await getMessageById(messageId);
      if (!message) {
        return NextResponse.json({ error: '消息不存在' }, { status: 404 });
      }

      const permission = await checkDiscussionPermission(message.discussionId, userId);
      if (!permission.canAccess) {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }

      return NextResponse.json({ data: message });
    } catch (error) {
      console.error('获取消息失败:', error);
      return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
    }
  });
}

// PUT /api/project-discussions/messages/[id] - 编辑消息或置顶/取消置顶
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req, userId) => {
    try {
      const { id } = await params;
      const messageId = Number.parseInt(id, 10);
      if (!Number.isFinite(messageId) || messageId <= 0) {
        return NextResponse.json({ error: '无效的消息ID' }, { status: 400 });
      }

      const body = await req.json();
      const { action, content } = body;

      const message = await getMessageById(messageId);
      if (!message) {
        return NextResponse.json({ error: '消息不存在' }, { status: 404 });
      }

      const projectId = await resolveProjectIdFromMessage(message.discussionId);
      if (!projectId) {
        return NextResponse.json({ error: '消息关联项目不存在' }, { status: 404 });
      }

      // 编辑消息
      if (action === 'edit') {
        if (message.authorId !== userId) {
          return NextResponse.json({ error: '只能编辑自己的消息' }, { status: 403 });
        }
        const updated = await editMessage(messageId, content, userId);
        return NextResponse.json({ data: updated });
      }

      // 置顶消息
      if (action === 'pin') {
        const permission = await checkProjectPermission(projectId, userId);
        if (!permission || permission === 'level_3') {
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }
        const updated = await pinMessage(messageId, userId);
        return NextResponse.json({ data: updated });
      }

      // 取消置顶
      if (action === 'unpin') {
        const permission = await checkProjectPermission(projectId, userId);
        if (!permission || permission === 'level_3') {
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }
        const updated = await unpinMessage(messageId);
        return NextResponse.json({ data: updated });
      }

      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    } catch (error) {
      console.error('更新消息失败:', error);
      return NextResponse.json({ error: '更新消息失败' }, { status: 500 });
    }
  });
}

// DELETE /api/project-discussions/messages/[id] - 删除消息
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (_req, userId) => {
    try {
      const { id } = await params;
      const messageId = Number.parseInt(id, 10);
      if (!Number.isFinite(messageId) || messageId <= 0) {
        return NextResponse.json({ error: '无效的消息ID' }, { status: 400 });
      }

      const message = await getMessageById(messageId);
      if (!message) {
        return NextResponse.json({ error: '消息不存在' }, { status: 404 });
      }

      const projectId = await resolveProjectIdFromMessage(message.discussionId);
      if (!projectId) {
        return NextResponse.json({ error: '消息关联项目不存在' }, { status: 404 });
      }

      // 检查权限：只能删除自己的消息，或者一级权限可以删除所有消息
      const permission = await checkProjectPermission(projectId, userId);
      if (message.authorId !== userId && permission !== 'level_1') {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }

      await deleteMessage(messageId, userId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除消息失败:', error);
      return NextResponse.json({ error: '删除消息失败' }, { status: 500 });
    }
  });
}

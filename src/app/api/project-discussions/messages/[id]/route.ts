import { NextRequest, NextResponse } from 'next/server';
import {
  getMessageById,
  editMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
} from '@/lib/project-discussion/service';
import { checkProjectPermission } from '@/lib/project-org/service';

// GET /api/project-discussions/messages/[id] - 获取消息详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const message = await getMessageById(parseInt(id));
    
    if (!message) {
      return NextResponse.json({ error: '消息不存在' }, { status: 404 });
    }

    return NextResponse.json({ data: message });
  } catch (error) {
    console.error('获取消息失败:', error);
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 });
  }
}

// PUT /api/project-discussions/messages/[id] - 编辑消息或置顶/取消置顶
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, content, userId, projectId } = body;

    const message = await getMessageById(parseInt(id));
    if (!message) {
      return NextResponse.json({ error: '消息不存在' }, { status: 404 });
    }

    // 编辑消息
    if (action === 'edit') {
      // 只能编辑自己的消息
      if (message.authorId !== userId) {
        return NextResponse.json({ error: '只能编辑自己的消息' }, { status: 403 });
      }
      const updated = await editMessage(parseInt(id), content, userId);
      return NextResponse.json({ data: updated });
    }

    // 置顶消息
    if (action === 'pin') {
      // 检查权限（需要一级或二级权限）
      const permission = await checkProjectPermission(projectId, userId);
      if (!permission || permission === 'level_3') {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }
      const updated = await pinMessage(parseInt(id), userId);
      return NextResponse.json({ data: updated });
    }

    // 取消置顶
    if (action === 'unpin') {
      const permission = await checkProjectPermission(projectId, userId);
      if (!permission || permission === 'level_3') {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }
      const updated = await unpinMessage(parseInt(id));
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('更新消息失败:', error);
    return NextResponse.json({ error: '更新消息失败' }, { status: 500 });
  }
}

// DELETE /api/project-discussions/messages/[id] - 删除消息
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '0');
    const projectId = parseInt(searchParams.get('projectId') || '0');

    const message = await getMessageById(parseInt(id));
    if (!message) {
      return NextResponse.json({ error: '消息不存在' }, { status: 404 });
    }

    // 检查权限：只能删除自己的消息，或者一级权限可以删除所有消息
    const permission = await checkProjectPermission(projectId, userId);
    if (message.authorId !== userId && permission !== 'level_1') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    await deleteMessage(parseInt(id), userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除消息失败:', error);
    return NextResponse.json({ error: '删除消息失败' }, { status: 500 });
  }
}

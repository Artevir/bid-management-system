/**
 * 签署任务详情API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getSignTaskById,
  updateSignTask,
  cancelSignTask,
  initiateSignTask,
  getSignersByTaskId,
  getSignLogsByTaskId,
} from '@/lib/e-sign/service';

// GET /api/e-sign/tasks/[id] - 获取签署任务详情
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
    const taskId = parseInt(id);

    const task = await getSignTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: '签署任务不存在' }, { status: 404 });
    }

    // 获取签署者和日志
    const [signers, logs] = await Promise.all([
      getSignersByTaskId(taskId),
      getSignLogsByTaskId(taskId),
    ]);

    return NextResponse.json({
      ...task,
      signers,
      logs,
    });
  } catch (error) {
    console.error('获取签署任务详情失败:', error);
    return NextResponse.json({ error: '获取签署任务详情失败' }, { status: 500 });
  }
}

// PUT /api/e-sign/tasks/[id] - 更新签署任务
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    const body = await req.json();

    // 特殊操作：发起签署
    if (body.action === 'initiate') {
      const task = await initiateSignTask(taskId);
      return NextResponse.json(task);
    }

    // 特殊操作：取消签署
    if (body.action === 'cancel') {
      const task = await cancelSignTask(taskId);
      return NextResponse.json(task);
    }

    // 常规更新
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.expireAt !== undefined) updateData.expireAt = body.expireAt ? new Date(body.expireAt) : null;

    const task = await updateSignTask(taskId, updateData);

    return NextResponse.json(task);
  } catch (error) {
    console.error('更新签署任务失败:', error);
    return NextResponse.json({ error: '更新签署任务失败' }, { status: 500 });
  }
}

// DELETE /api/e-sign/tasks/[id] - 取消签署任务
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const task = await cancelSignTask(parseInt(id));

    return NextResponse.json(task);
  } catch (error) {
    console.error('取消签署任务失败:', error);
    return NextResponse.json({ error: '取消签署任务失败' }, { status: 500 });
  }
}

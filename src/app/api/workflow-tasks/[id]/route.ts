/**
 * 工作流任务详情 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getTaskDetail, completeTask } from '@/lib/workflow/service';

// 获取任务详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const task = await getTaskDetail(parseInt(id));

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('获取任务详情失败:', error);
    return NextResponse.json(
      { error: '获取任务详情失败' },
      { status: 500 }
    );
  }
}

// 处理任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, comment, transferTo } = body;

    if (!action || !['approve', 'reject', 'transfer'].includes(action)) {
      return NextResponse.json(
        { error: '无效的操作类型' },
        { status: 400 }
      );
    }

    if (action === 'transfer' && !transferTo) {
      return NextResponse.json(
        { error: '请指定转办目标用户' },
        { status: 400 }
      );
    }

    const result = await completeTask({
      taskId: parseInt(id),
      action,
      comment,
      transferTo,
      operatorId: user.userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('处理任务失败:', error);
    
    if (
      error.message === '任务不存在' ||
      error.message === '任务已处理'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    if (error.message === '无权处理此任务') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: '处理任务失败' },
      { status: 500 }
    );
  }
}

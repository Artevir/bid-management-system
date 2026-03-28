/**
 * 工作流实例详情 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getInstanceDetail, cancelWorkflowInstance } from '@/lib/workflow/service';

// 获取工作流实例详情
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
    const instance = await getInstanceDetail(parseInt(id));

    if (!instance) {
      return NextResponse.json({ error: '工作流实例不存在' }, { status: 404 });
    }

    return NextResponse.json(instance);
  } catch (error) {
    console.error('获取工作流实例失败:', error);
    return NextResponse.json(
      { error: '获取工作流实例失败' },
      { status: 500 }
    );
  }
}

// 取消工作流实例
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    await cancelWorkflowInstance(parseInt(id), user.userId, reason);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('取消工作流实例失败:', error);
    
    if (
      error.message === '实例不存在' ||
      error.message === '只有运行中的流程可以取消'
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    if (error.message === '只有流程发起人可以取消') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: '取消工作流实例失败' },
      { status: 500 }
    );
  }
}

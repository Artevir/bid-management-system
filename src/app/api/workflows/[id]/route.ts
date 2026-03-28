/**
 * 工作流定义详情 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
} from '@/lib/workflow/service';

// 获取工作流定义详情
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
    const definition = await getWorkflowDefinition(parseInt(id));

    if (!definition) {
      return NextResponse.json({ error: '工作流定义不存在' }, { status: 404 });
    }

    return NextResponse.json(definition);
  } catch (error) {
    console.error('获取工作流定义失败:', error);
    return NextResponse.json(
      { error: '获取工作流定义失败' },
      { status: 500 }
    );
  }
}

// 更新工作流定义
export async function PUT(
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

    await updateWorkflowDefinition(parseInt(id), body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新工作流定义失败:', error);
    return NextResponse.json(
      { error: '更新工作流定义失败' },
      { status: 500 }
    );
  }
}

// 删除工作流定义
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
    await deleteWorkflowDefinition(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('删除工作流定义失败:', error);
    
    if (error.message === '存在运行中的流程实例，无法删除') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '删除工作流定义失败' },
      { status: 500 }
    );
  }
}

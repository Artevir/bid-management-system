/**
 * 工作流设计保存 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { saveWorkflowDesign } from '@/lib/workflow/service';

// 保存工作流设计（节点和连线）
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
    const { nodes, transitions } = body;

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: '节点数据无效' }, { status: 400 });
    }

    if (!transitions || !Array.isArray(transitions)) {
      return NextResponse.json({ error: '连线数据无效' }, { status: 400 });
    }

    await saveWorkflowDesign(parseInt(id), nodes, transitions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存工作流设计失败:', error);
    return NextResponse.json(
      { error: '保存工作流设计失败' },
      { status: 500 }
    );
  }
}

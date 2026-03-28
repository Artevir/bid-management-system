/**
 * 工作流实例 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { startWorkflowInstance } from '@/lib/workflow/service';

// 启动工作流实例
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { definitionId, businessType, businessId, businessTitle, variables } = body;

    if (!definitionId || !businessType || !businessId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const result = await startWorkflowInstance({
      definitionId,
      businessType,
      businessId,
      businessTitle,
      variables,
      createdBy: user.userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('启动工作流失败:', error);
    
    if (error.message === '工作流定义不存在') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    if (error.message === '工作流未启用') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: '启动工作流失败' },
      { status: 500 }
    );
  }
}

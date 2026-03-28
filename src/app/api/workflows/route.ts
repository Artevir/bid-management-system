/**
 * 工作流定义 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  createWorkflowDefinition,
  getWorkflowDefinitionList,
} from '@/lib/workflow/service';

// 获取工作流定义列表
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const params = {
      category: searchParams.get('category') || undefined,
      businessType: searchParams.get('businessType') || undefined,
      status: searchParams.get('status') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    };

    const result = await getWorkflowDefinitionList(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取工作流定义列表失败:', error);
    return NextResponse.json(
      { error: '获取工作流定义列表失败' },
      { status: 500 }
    );
  }
}

// 创建工作流定义
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, description, category, businessType, config } = body;

    if (!name || !code) {
      return NextResponse.json({ error: '名称和编码不能为空' }, { status: 400 });
    }

    const result = await createWorkflowDefinition({
      name,
      code,
      description,
      category,
      businessType,
      config,
      createdBy: user.userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('创建工作流定义失败:', error);
    
    // 处理唯一约束错误
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '工作流编码已存在' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '创建工作流定义失败' },
      { status: 500 }
    );
  }
}

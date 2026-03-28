/**
 * 方案分类 API
 * GET: 获取分类列表
 * POST: 创建分类
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getCategoryTree,
  createCategory,
  CreateCategoryParams,
} from '@/lib/scheme/service';

// 获取分类树
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const tree = await getCategoryTree();

    return NextResponse.json({ categories: tree });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return NextResponse.json(
      { error: '获取分类列表失败' },
      { status: 500 }
    );
  }
}

// 创建分类
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
    }

    const data: CreateCategoryParams = {
      name: body.name,
      code: body.code,
      description: body.description,
      parentId: body.parentId,
      type: body.type,
      createdBy: user.userId,
    };

    const category = await createCategory(data);

    return NextResponse.json(
      {
        success: true,
        message: '分类创建成功',
        category,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('创建分类失败:', error);
    return NextResponse.json(
      { error: error.message || '创建分类失败' },
      { status: 400 }
    );
  }
}

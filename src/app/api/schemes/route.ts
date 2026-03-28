/**
 * 方案库 API
 * GET: 获取方案列表
 * POST: 创建方案或章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getSchemeList,
  createScheme,
  createChapter,
  getPopularTags,
  CreateSchemeParams,
} from '@/lib/scheme/service';

// 获取方案列表
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // 判断是获取标签还是列表
    if (searchParams.get('tags') === 'popular') {
      const tags = await getPopularTags(20);
      return NextResponse.json({ tags });
    }

    const params = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      keyword: searchParams.get('keyword') || undefined,
      categoryId: searchParams.get('categoryId') 
        ? parseInt(searchParams.get('categoryId')!) 
        : undefined,
      stage: searchParams.get('stage') || undefined,
      status: searchParams.get('status') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      createdBy: searchParams.get('createdBy') 
        ? parseInt(searchParams.get('createdBy')!) 
        : undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    };

    const result = await getSchemeList(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取方案列表失败:', error);
    return NextResponse.json(
      { error: '获取方案列表失败' },
      { status: 500 }
    );
  }
}

// 创建方案或章节
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();

    // 判断是创建章节还是方案
    if (body.action === 'createChapter') {
      if (!body.schemeId || !body.title?.trim()) {
        return NextResponse.json(
          { error: '缺少必要参数' },
          { status: 400 }
        );
      }

      const chapter = await createChapter({
        schemeId: body.schemeId,
        title: body.title,
        parentId: body.parentId,
        serialNumber: body.serialNumber,
      });

      return NextResponse.json(
        {
          success: true,
          message: '章节创建成功',
          chapter,
        },
        { status: 201 }
      );
    }

    // 创建方案
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: '方案名称不能为空' }, { status: 400 });
    }

    const data: CreateSchemeParams = {
      name: body.name,
      code: body.code,
      description: body.description,
      categoryId: body.categoryId,
      stage: body.stage,
      frameworkId: body.frameworkId,
      source: body.source || 'manual',
      tags: body.tags,
      createdBy: user.userId,
    };

    const scheme = await createScheme(data);

    return NextResponse.json(
      {
        success: true,
        message: '方案创建成功',
        scheme,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('创建失败:', error);
    return NextResponse.json(
      { error: error.message || '创建失败' },
      { status: 400 }
    );
  }
}

/**
 * 文件管理API
 * GET: 获取文件列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getFileList, getFileCategories, initFileCategories } from '@/lib/file/service';
import { DocumentSecurityLevel } from '@/types/document';

// 获取文件列表
async function getList(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      keyword: searchParams.get('keyword') || undefined,
      categoryId: searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!) : undefined,
      securityLevel: searchParams.get('securityLevel') as DocumentSecurityLevel | undefined,
      projectId: searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined,
      uploaderId: searchParams.get('uploaderId') ? parseInt(searchParams.get('uploaderId')!) : undefined,
      status: searchParams.get('status') || 'active',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    };

    const { items, total } = await getFileList(params, userId);

    return NextResponse.json({
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    });
  } catch (error) {
    console.error('Get file list error:', error);
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 });
  }
}

// 获取文件分类
async function getCategories(
  _request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    // 确保分类已初始化
    await initFileCategories();

    const categories = await getFileCategories();

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Get file categories error:', error);
    return NextResponse.json({ error: '获取文件分类失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 如果请求分类列表
  if (searchParams.get('categories') === 'true') {
    return withAuth(request, getCategories);
  }

  return withAuth(request, getList);
}

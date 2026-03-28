/**
 * 回收站API
 * GET: 获取回收站列表
 * POST: 移动资源到回收站
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getRecycleBinList,
  moveToRecycleBin,
  getRecycleBinStats,
  ResourceType,
} from '@/lib/recycle-bin/service';

// 获取回收站列表
async function getList(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const result = await getRecycleBinList({
      resourceType: searchParams.get('resourceType') as ResourceType || undefined,
      keyword: searchParams.get('keyword') || undefined,
      projectId: searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined,
      companyId: searchParams.get('companyId') ? parseInt(searchParams.get('companyId')!) : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 20,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error) {
    console.error('Get recycle bin list error:', error);
    return NextResponse.json({ error: '获取回收站列表失败' }, { status: 500 });
  }
}

// 获取回收站统计
async function getStats(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const stats = await getRecycleBinStats(userId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get recycle bin stats error:', error);
    return NextResponse.json({ error: '获取回收站统计失败' }, { status: 500 });
  }
}

// 移动资源到回收站
async function moveToBin(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { resourceType, resourceId, deleteReason } = body;

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const result = await moveToRecycleBin({
      resourceType: resourceType as ResourceType,
      resourceId,
      deletedBy: userId,
      deleteReason,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: { recycleBinId: result.recycleBinId },
    });
  } catch (error) {
    console.error('Move to recycle bin error:', error);
    return NextResponse.json({ error: '移至回收站失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  if (searchParams.get('stats') === 'true') {
    return withAuth(request, getStats);
  }
  
  return withAuth(request, getList);
}

export async function POST(request: NextRequest) {
  return withAuth(request, moveToBin);
}

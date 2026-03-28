/**
 * 回收站详情API
 * GET: 获取回收站详情
 * DELETE: 永久删除资源
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getRecycleBinDetail,
  permanentDelete,
} from '@/lib/recycle-bin/service';

// 获取回收站详情
async function getDetail(
  request: NextRequest,
  userId: number,
  recycleBinId: number
): Promise<NextResponse> {
  try {
    const detail = await getRecycleBinDetail(recycleBinId);

    if (!detail) {
      return NextResponse.json({ error: '回收站记录不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error('Get recycle bin detail error:', error);
    return NextResponse.json({ error: '获取回收站详情失败' }, { status: 500 });
  }
}

// 永久删除资源
async function deletePermanently(
  request: NextRequest,
  userId: number,
  recycleBinId: number
): Promise<NextResponse> {
  try {
    const result = await permanentDelete(recycleBinId, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Permanent delete error:', error);
    return NextResponse.json({ error: '永久删除失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getDetail(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => deletePermanently(req, userId, parseInt(id)));
}

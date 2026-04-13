/**
 * 图片详情 API
 * GET: 获取图片详情
 * PUT: 更新图片信息
 * DELETE: 删除图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';

// GET /api/image/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const imageId = parseInt(id);

    if (isNaN(imageId)) {
      return NextResponse.json({ error: '无效的图片ID' }, { status: 400 });
    }

    const { getImageById } = await import('@/lib/image/service');
    const image = await getImageById(imageId);

    if (!image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }

    return NextResponse.json({ image });
  } catch (error: any) {
    console.error('获取图片详情失败:', error);
    return NextResponse.json({ error: error.message || '获取图片详情失败' }, { status: 500 });
  }
}

// PUT /api/image/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const imageId = parseInt(id);

    if (isNaN(imageId)) {
      return NextResponse.json({ error: '无效的图片ID' }, { status: 400 });
    }

    const body = await request.json();
    const { updateImage } = await import('@/lib/image/service');
    const image = await updateImage(imageId, body);

    if (!image) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, image });
  } catch (error: any) {
    console.error('更新图片失败:', error);
    return NextResponse.json({ error: error.message || '更新图片失败' }, { status: 500 });
  }
}

// DELETE /api/image/[id]
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
    const imageId = parseInt(id);

    if (isNaN(imageId)) {
      return NextResponse.json({ error: '无效的图片ID' }, { status: 400 });
    }

    const { deleteImage } = await import('@/lib/image/service');
    await deleteImage(imageId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('删除图片失败:', error);
    return NextResponse.json({ error: error.message || '删除图片失败' }, { status: 500 });
  }
}

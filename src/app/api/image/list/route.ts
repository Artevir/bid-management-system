/**
 * 图片列表 API
 * GET: 获取图片列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import type { ImageType, ImageStatus } from '@/lib/image/service';

// GET /api/image/list
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const imageType = searchParams.get('imageType') as ImageType | null;
    const status = searchParams.get('status') as ImageStatus | null;
    const projectId = searchParams.get('projectId');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const { getImageList } = await import('@/lib/image/service');
    const images = await getImageList({
      imageType: imageType || undefined,
      status: status || undefined,
      projectId: projectId ? parseInt(projectId) : undefined,
      createdBy: user.userId,
      search: search || undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : undefined,
    });

    return NextResponse.json({ images });
  } catch (error: any) {
    console.error('获取图片列表失败:', error);
    return NextResponse.json({ error: error.message || '获取图片列表失败' }, { status: 500 });
  }
}

/**
 * 方案详情 API
 * GET: 获取方案详情
 * PUT: 更新方案
 * DELETE: 删除方案
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getSchemeById,
  updateScheme,
  deleteScheme,
  archiveScheme,
  getSchemeChapters,
  exportSchemeAsText,
} from '@/lib/scheme/service';

// 获取方案详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const schemeId = parseInt(id, 10);

    if (isNaN(schemeId)) {
      return NextResponse.json({ error: '无效的方案ID' }, { status: 400 });
    }

    // 判断是获取章节还是详情
    const { searchParams } = new URL(request.url);
    if (searchParams.get('chapters') === 'true') {
      const chapters = await getSchemeChapters(schemeId);
      return NextResponse.json({ chapters });
    }

    // 导出
    if (searchParams.get('export') === 'text') {
      const content = await exportSchemeAsText(schemeId);
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="scheme.txt"',
        },
      });
    }

    const scheme = await getSchemeById(schemeId);

    if (!scheme) {
      return NextResponse.json({ error: '方案不存在' }, { status: 404 });
    }

    return NextResponse.json({ scheme });
  } catch (error) {
    console.error('获取方案详情失败:', error);
    return NextResponse.json(
      { error: '获取方案详情失败' },
      { status: 500 }
    );
  }
}

// 更新方案
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const schemeId = parseInt(id, 10);

    if (isNaN(schemeId)) {
      return NextResponse.json({ error: '无效的方案ID' }, { status: 400 });
    }

    const body = await request.json();

    // 归档操作
    if (body.action === 'archive') {
      await archiveScheme(schemeId, user.userId);
      return NextResponse.json({ success: true, message: '方案已归档' });
    }

    await updateScheme(schemeId, body);

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error: any) {
    console.error('更新方案失败:', error);
    return NextResponse.json(
      { error: error.message || '更新方案失败' },
      { status: 400 }
    );
  }
}

// 删除方案
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
    const schemeId = parseInt(id, 10);

    if (isNaN(schemeId)) {
      return NextResponse.json({ error: '无效的方案ID' }, { status: 400 });
    }

    await deleteScheme(schemeId);

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('删除方案失败:', error);
    return NextResponse.json(
      { error: error.message || '删除方案失败' },
      { status: 400 }
    );
  }
}

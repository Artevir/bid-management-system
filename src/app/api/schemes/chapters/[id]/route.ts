/**
 * 方案章节 API
 * GET: 获取章节详情
 * PUT: 更新章节内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { db } from '@/db';
import { schemeChapters } from '@/db/scheme-schema';
import { eq } from 'drizzle-orm';
import { updateChapterContent } from '@/lib/scheme/service';

// 获取章节详情
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
    const chapterId = parseInt(id, 10);

    if (isNaN(chapterId)) {
      return NextResponse.json({ error: '无效的章节ID' }, { status: 400 });
    }

    const [chapter] = await db
      .select()
      .from(schemeChapters)
      .where(eq(schemeChapters.id, chapterId))
      .limit(1);

    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 });
    }

    return NextResponse.json({ chapter });
  } catch (error) {
    console.error('获取章节详情失败:', error);
    return NextResponse.json(
      { error: '获取章节详情失败' },
      { status: 500 }
    );
  }
}

// 更新章节
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
    const chapterId = parseInt(id, 10);

    if (isNaN(chapterId)) {
      return NextResponse.json({ error: '无效的章节ID' }, { status: 400 });
    }

    const body = await request.json();

    // 更新内容
    if (body.content !== undefined) {
      await updateChapterContent(chapterId, body.content, user.userId);
    }

    // 更新其他字段
    if (body.title || body.serialNumber || body.sortOrder !== undefined) {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (body.title) updateData.title = body.title;
      if (body.serialNumber) updateData.serialNumber = body.serialNumber;
      if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

      await db
        .update(schemeChapters)
        .set(updateData)
        .where(eq(schemeChapters.id, chapterId));
    }

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error: any) {
    console.error('更新章节失败:', error);
    return NextResponse.json(
      { error: error.message || '更新章节失败' },
      { status: 400 }
    );
  }
}

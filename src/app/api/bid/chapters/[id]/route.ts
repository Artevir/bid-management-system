/**
 * 章节详情API
 * GET: 获取章节详情
 * PUT: 更新章节
 * DELETE: 删除章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkChapterPermission } from '@/lib/auth/resource-permission';
import {
  getChapterDetail,
  updateChapter,
  deleteChapter,
} from '@/lib/bid/service';

// 获取章节详情
async function getChapter(
  request: NextRequest,
  userId: number,
  chapterId: number
): Promise<NextResponse> {
  try {
    // 权限检查：读取章节
    const permissionResult = await checkChapterPermission(userId, chapterId, 'read');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权访问此章节' },
        { status: 403 }
      );
    }

    const chapter = await getChapterDetail(chapterId);

    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 });
    }

    return NextResponse.json({ chapter });
  } catch (error) {
    console.error('Get chapter error:', error);
    return NextResponse.json({ error: '获取章节失败' }, { status: 500 });
  }
}

// 更新章节
async function updateChapterContent(
  request: NextRequest,
  userId: number,
  chapterId: number
): Promise<NextResponse> {
  try {
    // 权限检查：编辑章节
    const permissionResult = await checkChapterPermission(userId, chapterId, 'edit');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权编辑此章节' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, isCompleted, assignedTo, deadline } = body;

    await updateChapter(chapterId, {
      title,
      content,
      isCompleted,
      assignedTo,
      deadline: deadline ? new Date(deadline) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: '章节更新成功',
    });
  } catch (error) {
    console.error('Update chapter error:', error);
    return NextResponse.json({ error: '更新章节失败' }, { status: 500 });
  }
}

// 删除章节
async function deleteChapterById(
  request: NextRequest,
  userId: number,
  chapterId: number
): Promise<NextResponse> {
  try {
    // 权限检查：删除章节
    const permissionResult = await checkChapterPermission(userId, chapterId, 'delete');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权删除此章节' },
        { status: 403 }
      );
    }

    const chapter = await getChapterDetail(chapterId);
    if (!chapter) {
      return NextResponse.json({ error: '章节不存在' }, { status: 404 });
    }

    await deleteChapter(chapterId);

    return NextResponse.json({
      success: true,
      message: '章节删除成功',
    });
  } catch (error) {
    console.error('Delete chapter error:', error);
    return NextResponse.json({ error: '删除章节失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getChapter(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => updateChapterContent(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => deleteChapterById(req, userId, parseInt(id)));
}

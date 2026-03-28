/**
 * 标书章节API
 * GET: 获取文档章节树
 * POST: 创建章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getChapterTree,
  createChapter,
} from '@/lib/bid/service';

// 获取章节树
async function getChapters(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    const chapters = await getChapterTree(parseInt(documentId));

    return NextResponse.json({ chapters });
  } catch (error) {
    console.error('Get chapters error:', error);
    return NextResponse.json({ error: '获取章节失败' }, { status: 500 });
  }
}

// 创建章节
async function createNewChapter(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      documentId,
      parentId,
      type,
      serialNumber,
      title,
      content,
      isRequired,
      assignedTo,
      deadline,
      responseItemId,
    } = body;

    if (!documentId || !title) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const chapterId = await createChapter({
      documentId,
      parentId,
      type,
      serialNumber,
      title,
      content,
      isRequired,
      assignedTo,
      deadline: deadline ? new Date(deadline) : undefined,
      responseItemId,
    });

    return NextResponse.json({
      success: true,
      chapterId,
      message: '章节创建成功',
    });
  } catch (error) {
    console.error('Create chapter error:', error);
    return NextResponse.json({ error: '创建章节失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getChapters(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createNewChapter(req, userId));
}

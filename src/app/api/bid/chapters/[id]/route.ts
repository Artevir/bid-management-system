/**
 * 章节详情API
 * GET: 获取章节详情
 * PUT: 更新章节
 * DELETE: 删除章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withChapterPermission } from '@/lib/auth/middleware';
import {
  getChapterDetail,
  updateChapter,
} from '@/lib/bid/documents-service';
import { success, AppError, handleError } from '@/lib/api/error-handler';
import { db } from '@/db';
import { bidChapters } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 获取章节详情
async function getChapter(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const chapterId = parseInt(request.url.split('/').slice(-1)[0], 10);
  
  if (isNaN(chapterId)) {
    throw AppError.badRequest('无效的章节ID');
  }

  const chapter = await getChapterDetail(chapterId);

  if (!chapter) {
    throw AppError.notFound('章节');
  }

  return success({ chapter });
}

// 更新章节
async function updateChapterContent(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const chapterId = parseInt(request.url.split('/').slice(-1)[0], 10);
  
  if (isNaN(chapterId)) {
    throw AppError.badRequest('无效的章节ID');
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

  return success(null, '章节更新成功');
}

// 删除章节
async function deleteChapterById(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const chapterId = parseInt(request.url.split('/').slice(-1)[0], 10);
  
  if (isNaN(chapterId)) {
    throw AppError.badRequest('无效的章节ID');
  }

  const chapter = await getChapterDetail(chapterId);
  if (!chapter) {
    throw AppError.notFound('章节');
  }

  // 递归删除子章节逻辑建议下沉到 Service，这里保持原子性
  await db.delete(bidChapters).where(eq(bidChapters.id, chapterId));

  return success(null, '章节删除成功');
}

export async function GET(request: NextRequest) {
  const chapterId = parseInt(request.url.split('/').slice(-1)[0], 10);
  return withChapterPermission('read', () => chapterId)(request, (req, userId) => getChapter(req, userId));
}

export async function PUT(request: NextRequest) {
  const chapterId = parseInt(request.url.split('/').slice(-1)[0], 10);
  return withChapterPermission('edit', () => chapterId)(request, (req, userId) => updateChapterContent(req, userId));
}

export async function DELETE(request: NextRequest) {
  const chapterId = parseInt(request.url.split('/').slice(-1)[0], 10);
  return withChapterPermission('delete', () => chapterId)(request, (req, userId) => deleteChapterById(req, userId));
}

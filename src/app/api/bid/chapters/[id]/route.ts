/**
 * 章节详情API
 * GET: 获取章节详情
 * PUT: 更新章节
 * DELETE: 删除章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { withChapterPermission } from '@/lib/auth/middleware';
import {
  getChapterDetail,
  updateChapter,
  deleteChapter,
} from '@/lib/bid/documents-service';
import { success, AppError } from '@/lib/api/error-handler';
import { parseIdFromParams } from '@/lib/api/validators';

// 获取章节详情
async function getChapter(
  request: NextRequest,
  userId: number,
  params: any
): Promise<NextResponse> {
  const chapterId = parseIdFromParams(params, 'id', '章节');
  const chapter = await getChapterDetail(chapterId);

  if (!chapter) {
    throw AppError.notFound('章节');
  }

  return success({ chapter });
}

// 更新章节
async function updateChapterContent(
  request: NextRequest,
  userId: number,
  params: any
): Promise<NextResponse> {
  const chapterId = parseIdFromParams(params, 'id', '章节');
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
  userId: number,
  params: any
): Promise<NextResponse> {
  const chapterId = parseIdFromParams(params, 'id', '章节');
  await deleteChapter(chapterId);
  return success(null, '章节删除成功');
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const middleware = await withChapterPermission('read', (req, p) => parseIdFromParams(p, 'id', '章节'));
  return middleware(request, getChapter, params);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const middleware = await withChapterPermission('edit', (req, p) => parseIdFromParams(p, 'id', '章节'));
  return middleware(request, updateChapterContent, params);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const middleware = await withChapterPermission('delete', (req, p) => parseIdFromParams(p, 'id', '章节'));
  return middleware(request, deleteChapterById, params);
}

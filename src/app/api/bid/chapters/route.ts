/**
 * 标书章节API
 * GET: 获取文档章节树
 * POST: 创建章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { withDocumentPermission } from '@/lib/auth/middleware';
import {
  getChapterTree,
  createChapter,
} from '@/lib/bid/documents-service';
import { success, created, AppError } from '@/lib/api/error-handler';
import { parseResourceId } from '@/lib/api/validators';

// 获取章节树
async function getChapters(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const documentIdStr = searchParams.get('documentId');
  const documentId = parseResourceId(documentIdStr, '文档');

  const chapters = await getChapterTree(documentId);

  return success(chapters);
}

// 创建章节
async function createNewChapter(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const body = await request.json();
  const {
    documentId: documentIdRaw,
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

  if (!title) {
    throw AppError.badRequest('缺少章节标题');
  }

  const documentId = parseResourceId(documentIdRaw?.toString(), '文档');

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

  return created({ chapterId }, '章节创建成功');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = parseResourceId(searchParams.get('documentId'), '文档');
  const readMiddleware = await withDocumentPermission('read', () => documentId);
  return readMiddleware(request, (req, userId) => getChapters(req, userId));
}

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}));
  const documentId = parseResourceId(body.documentId?.toString(), '文档');
  const editMiddleware = await withDocumentPermission('edit', () => documentId);
  return editMiddleware(request, (req, userId) => createNewChapter(req, userId));
}

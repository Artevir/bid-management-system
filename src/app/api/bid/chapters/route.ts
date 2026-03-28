/**
 * 标书章节API
 * GET: 获取文档章节树
 * POST: 创建章节
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withDocumentPermission } from '@/lib/auth/middleware';
import {
  getChapterTree,
  createChapter,
} from '@/lib/bid/documents-service';
import { success, created, AppError, handleError } from '@/lib/api/error-handler';

// 获取章节树
async function getChapters(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    throw AppError.badRequest('缺少文档ID');
  }

  const chapters = await getChapterTree(parseInt(documentId, 10));

  return success({ chapters });
}

// 创建章节
async function createNewChapter(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
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
    throw AppError.badRequest('缺少必填字段: documentId, title');
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

  return created({ chapterId }, '章节创建成功');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = parseInt(searchParams.get('documentId') || '0', 10);
  return withDocumentPermission('read', () => documentId)(request, (req, userId) => getChapters(req, userId));
}

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}));
  const documentId = parseInt(body.documentId || '0', 10);
  return withDocumentPermission('edit', () => documentId)(request, (req, userId) => createNewChapter(req, userId));
}

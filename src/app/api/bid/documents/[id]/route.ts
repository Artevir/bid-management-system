/**
 * 标书文档详情API
 * GET: 获取文档详情
 * PUT: 更新文档信息
 * DELETE: 删除文档（默认移至回收站，permanent=true时物理删除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withDocumentPermission } from '@/lib/auth/middleware';
import { moveToRecycleBin, permanentDelete } from '@/lib/recycle-bin/service';
import { db } from '@/db';
import { bidDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  getDocumentById,
  updateDocumentStatus,
  getDocumentChapterStatistics,
} from '@/lib/bid/documents-service';
import { success, AppError, handleError } from '@/lib/api/error-handler';

// 获取文档详情
async function getDocument(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const documentId = parseInt(request.url.split('/').slice(-1)[0], 10);
  
  if (isNaN(documentId)) {
    throw AppError.badRequest('无效的文档ID');
  }

  const document = await getDocumentById(documentId);

  if (!document) {
    throw AppError.notFound('文档');
  }

  // 获取章节统计 (业务逻辑已下沉至 Service 层)
  const statistics = await getDocumentChapterStatistics(documentId);

  return success({
    document,
    statistics,
  });
}

// 更新文档
async function updateDocument(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const documentId = parseInt(request.url.split('/').slice(-1)[0], 10);
  
  if (isNaN(documentId)) {
    throw AppError.badRequest('无效的文档ID');
  }

  const body = await request.json();
  const { name, status, deadline } = body;

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (name) updateData.name = name;
  if (status) updateData.status = status;
  if (deadline) updateData.deadline = new Date(deadline);

  await db
    .update(bidDocuments)
    .set(updateData)
    .where(eq(bidDocuments.id, documentId));

  return success(null, '文档更新成功');
}

// 删除文档
async function deleteDoc(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  const documentId = parseInt(request.url.split('/').slice(-1)[0], 10);
  
  if (isNaN(documentId)) {
    throw AppError.badRequest('无效的文档ID');
  }

  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';

  if (permanent) {
    await permanentDelete('document', documentId, userId);
  } else {
    await moveToRecycleBin('document', documentId, userId);
  }

  return success(null, permanent ? '文档已永久删除' : '文档已移至回收站');
}

export async function GET(request: NextRequest) {
  const documentId = parseInt(request.url.split('/').slice(-1)[0], 10);
  return withDocumentPermission('read', () => documentId)(request, (req, userId) => getDocument(req, userId));
}

export async function PUT(request: NextRequest) {
  const documentId = parseInt(request.url.split('/').slice(-1)[0], 10);
  return withDocumentPermission('edit', () => documentId)(request, (req, userId) => updateDocument(req, userId));
}

export async function DELETE(request: NextRequest) {
  const documentId = parseInt(request.url.split('/').slice(-1)[0], 10);
  return withDocumentPermission('delete', () => documentId)(request, (req, userId) => deleteDoc(req, userId));
}

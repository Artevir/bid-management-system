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
  getDocumentChapterStatistics,
} from '@/lib/bid/documents-service';
import { success, AppError } from '@/lib/api/error-handler';
import { parseIdFromParams } from '@/lib/api/validators';

// 获取文档详情
async function getDocument(
  request: NextRequest,
  userId: number,
  params: any
): Promise<NextResponse> {
  const documentId = parseIdFromParams(params, 'id', '文档');
  const document = await getDocumentById(documentId);

  if (!document) {
    throw AppError.notFound('文档');
  }

  // 获取章节统计
  const statistics = await getDocumentChapterStatistics(documentId);

  return success({
    document,
    statistics,
  });
}

// 更新文档
async function updateDocument(
  request: NextRequest,
  userId: number,
  params: any
): Promise<NextResponse> {
  const documentId = parseIdFromParams(params, 'id', '文档');
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
  userId: number,
  params: any
): Promise<NextResponse> {
  const documentId = parseIdFromParams(params, 'id', '文档');
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get('permanent') === 'true';

  if (permanent) {
    const moved = await moveToRecycleBin({
      resourceType: 'document',
      resourceId: documentId,
      deletedBy: userId,
    });
    if (!moved.recycleBinId) {
      throw AppError.badRequest(moved.message);
    }
    await permanentDelete(moved.recycleBinId, userId);
  } else {
    const moved = await moveToRecycleBin({
      resourceType: 'document',
      resourceId: documentId,
      deletedBy: userId,
    });
    if (!moved.success) {
      throw AppError.badRequest(moved.message);
    }
  }

  return success(null, permanent ? '文档已永久删除' : '文档已移至回收站');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const middleware = await withDocumentPermission('read', (req, p) => parseIdFromParams(p, 'id', '文档'));
  const p = await params;
  return middleware(request, getDocument, p);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const middleware = await withDocumentPermission('edit', (req, p) => parseIdFromParams(p, 'id', '文档'));
  const p = await params;
  return middleware(request, updateDocument, p);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const middleware = await withDocumentPermission('delete', (req, p) => parseIdFromParams(p, 'id', '文档'));
  const p = await params;
  return middleware(request, deleteDoc, p);
}

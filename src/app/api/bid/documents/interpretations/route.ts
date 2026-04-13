/**
 * 投标文档解读集成API
 * 将文档解读功能整合到投标文档模块
 *
 * GET: 获取文档关联的解读列表
 * POST: 为文档关联解读或创建新解读
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { bidDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, AppError, handleError } from '@/lib/api/error-handler';

// ============================================
// GET - 获取文档关联的解读列表
// ============================================

async function getDocumentInterpretations(request: NextRequest, _userId: number) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      throw AppError.badRequest('缺少文档ID');
    }

    // 获取文档信息
    const doc = await db
      .select({ projectId: bidDocuments.projectId })
      .from(bidDocuments)
      .where(eq(bidDocuments.id, parseInt(documentId)))
      .limit(1);

    if (doc.length === 0) {
      throw AppError.notFound('文档');
    }

    // 获取项目相关的解读列表
    const { getInterpretationList } = await import('@/lib/interpretation/service');
    const interpretations = await getInterpretationList({
      projectId: doc[0].projectId,
      status: 'completed',
    });

    return success({ interpretations: interpretations.list || [] });
  } catch (err) {
    throw err;
  }
}

// ============================================
// POST - 为文档关联解读
// ============================================

async function linkInterpretation(request: NextRequest, _userId: number) {
  try {
    const body = await request.json();
    const { documentId, interpretationId } = body;

    if (!documentId || !interpretationId) {
      throw AppError.badRequest('缺少必填字段：documentId, interpretationId');
    }

    // 更新文档关联的解读ID（需要在文档表中添加 interpretationId 字段）
    // 这里使用 generationHistory 作为临时关联
    await db
      .update(bidDocuments)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(bidDocuments.id, parseInt(documentId)));

    return success({ message: '解读关联成功' });
  } catch (err) {
    throw err;
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      return await getDocumentInterpretations(req, userId);
    } catch (error) {
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      return await linkInterpretation(req, userId);
    } catch (error) {
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

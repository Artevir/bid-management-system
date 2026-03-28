/**
 * 投标文档签章集成API
 * 将签章申请功能整合到投标文档模块
 *
 * GET: 获取文档关联的签章申请列表
 * POST: 为文档创建签章申请
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  createSealApplication,
  getSealApplications,
} from '@/lib/bid-seal/service';
import { db } from '@/db';
import { bidDocuments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { success, created, AppError, handleError } from '@/lib/api/error-handler';

// ============================================
// GET - 获取文档关联的签章申请列表
// ============================================

async function getDocumentSealApplications(
  request: NextRequest,
  userId: number
) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      throw AppError.badRequest('缺少文档ID');
    }

    // 获取文档信息
    const doc = await db
      .select({
        id: bidDocuments.id,
        projectId: bidDocuments.projectId,
        name: bidDocuments.name,
      })
      .from(bidDocuments)
      .where(eq(bidDocuments.id, parseInt(documentId)))
      .limit(1);

    if (doc.length === 0) {
      throw AppError.notFound('文档');
    }

    // 获取项目相关的签章申请列表
    const applications = await getSealApplications({});

    // 筛选与当前文档相关的申请（通过项目ID）
    const documentApplications = applications.filter(
      (app: any) => app.projectId === doc[0].projectId
    );

    return success({ applications: documentApplications });
  } catch (err) {
    throw err;
  }
}

// ============================================
// POST - 为文档创建签章申请
// ============================================

async function createDocumentSealApplication(
  request: NextRequest,
  userId: number
) {
  try {
    const body = await request.json();
    const {
      documentId,
      projectId,
      sealMethod,
      printCopies,
      requiredBy,
      partnerCompanyId,
      partnerContactId,
      remarks,
    } = body;

    if (!documentId || !projectId || !sealMethod) {
      throw AppError.badRequest('缺少必填字段：documentId, projectId, sealMethod');
    }

    // 获取文档信息
    const doc = await db
      .select({ name: bidDocuments.name })
      .from(bidDocuments)
      .where(eq(bidDocuments.id, parseInt(documentId)))
      .limit(1);

    if (doc.length === 0) {
      throw AppError.notFound('文档');
    }

    // 创建签章申请
    const applicationId = await createSealApplication({
      projectId,
      projectName: '',
      sealMethod,
      sealCount: printCopies || 5,
      plannedDate: requiredBy ? new Date(requiredBy) : undefined,
      partnerCompanyId,
      partnerContactId,
      remarks,
      createdBy: userId,
    });

    return created(
      { applicationId },
      '签章申请创建成功'
    );
  } catch (err) {
    throw err;
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      return await getDocumentSealApplications(req, userId);
    } catch (error) {
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      return await createDocumentSealApplication(req, userId);
    } catch (error) {
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

/**
 * AI生成文档审核API
 * GET: 获取待审核列表
 * POST: 提交审核结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { checkResourcePermission } from '@/lib/auth/resource-permission';
import { hasProjectPermission } from '@/lib/project/member';
import { AppError, handleError } from '@/lib/api/error-handler';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const { oneClickGenerateService } = await import('@/lib/services/one-click-generate-service');
      const { searchParams } = new URL(req.url);
      const projectIdParam = searchParams.get('projectId');
      if (!projectIdParam) {
        throw AppError.badRequest('缺少项目ID');
      }
      const projectId = parseResourceId(projectIdParam, '项目');
      const hasAccess = await hasProjectPermission(projectId, userId, 'view');
      if (!hasAccess) {
        throw AppError.forbidden(`无权访问项目: ${projectId}`);
      }

      const reviews = await oneClickGenerateService.getPendingReviews(projectId);

      return NextResponse.json({
        success: true,
        data: reviews,
      });
    } catch (error: any) {
      console.error('Get pending reviews error:', error);
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const { oneClickGenerateService } = await import('@/lib/services/one-click-generate-service');
      const body = await req.json();
      const { documentId, reviewId, result, comments, chapterModifications } = body;

      if (!documentId || !reviewId || !result) {
        throw AppError.badRequest('缺少必要参数');
      }
      const documentIdNum = parseResourceId(String(documentId), '文档');
      const reviewIdNum = parseResourceId(String(reviewId), '审核');
      if (!['approved', 'rejected'].includes(result)) {
        throw AppError.badRequest('审核结果无效');
      }

      const permission = await checkResourcePermission(userId, 'document', documentIdNum, 'edit');
      if (!permission.allowed) {
        throw AppError.forbidden('无权审核该文档');
      }

      await oneClickGenerateService.reviewDocument(
        documentIdNum,
        reviewIdNum,
        {
          result,
          comments,
          chapterModifications,
        },
        userId
      );

      return NextResponse.json({
        success: true,
        message: result === 'approved' ? '审核通过' : '审核拒绝',
      });
    } catch (error: any) {
      console.error('Review document error:', error);
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

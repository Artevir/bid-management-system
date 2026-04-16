/**
 * 批量生成投标文档API
 * POST: 批量生成
 * GET: 获取批量任务状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { hasProjectPermission } from '@/lib/project/member';
import { parseResourceId } from '@/lib/api/validators';
import { checkResourcePermission } from '@/lib/auth/resource-permission';
import { AppError, handleError } from '@/lib/api/error-handler';
import { db } from '@/db';
import { bidDocumentInterpretations } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const { batchGenerateService } = await import('@/lib/services/batch-generate-service');
      const body = await req.json();
      const { items, generateOptions, parallel, maxParallel } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw AppError.badRequest('请提供要生成的文档列表');
      }

      // 验证每个 item 并做资源权限校验，避免服务层被直接滥用
      for (const item of items) {
        const projectId = parseResourceId(item.projectId?.toString(), '项目');
        const interpretationId = parseResourceId(item.interpretationId?.toString(), '解读');
        const documentName = String(item.documentName || '').trim();
        const companyIds = Array.isArray(item.companyIds)
          ? item.companyIds
              .map((id: any) => Number.parseInt(String(id), 10))
              .filter((id: number) => Number.isInteger(id) && id > 0)
          : [];

        if (!documentName || companyIds.length === 0) {
          throw AppError.badRequest('每个生成项必须包含项目ID、文档名称、解读ID和公司ID');
        }

        const hasAccess = await hasProjectPermission(projectId, userId, 'edit');
        if (!hasAccess) {
          throw AppError.forbidden(`无权编辑项目: ${projectId}`);
        }

        const matchedInterpretation = await db.query.bidDocumentInterpretations.findFirst({
          where: and(
            eq(bidDocumentInterpretations.id, interpretationId),
            eq(bidDocumentInterpretations.projectId, projectId)
          ),
          columns: { id: true },
        });
        if (!matchedInterpretation) {
          throw AppError.badRequest(`解读结果不存在或不属于项目: ${projectId}`);
        }

        for (const companyId of companyIds) {
          const permission = await checkResourcePermission(userId, 'company', companyId, 'read');
          if (!permission.allowed) {
            throw AppError.forbidden(`无权访问公司资料: ${companyId}`);
          }
        }

        item.projectId = projectId;
        item.interpretationId = interpretationId;
        item.documentName = documentName;
        item.companyIds = companyIds;
      }

      const customHeaders: Record<string, string> = {};
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        customHeaders['authorization'] = authHeader;
      }

      const result = await batchGenerateService.generateBatch(
        {
          items,
          generateOptions: generateOptions || {
            includeQualification: true,
            includePerformance: true,
            includeTechnical: true,
            includeBusiness: true,
            style: 'formal',
          },
          parallel: parallel || false,
          maxParallel: maxParallel || 3,
        },
        userId,
        customHeaders
      );

      return NextResponse.json({
        success: true,
        batch: result,
      });
    } catch (error: any) {
      console.error('Batch generate error:', error);
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const { batchGenerateService } = await import('@/lib/services/batch-generate-service');
      const { searchParams } = new URL(req.url);
      const batchId = searchParams.get('batchId');

      if (!batchId) {
        throw AppError.badRequest('缺少batchId参数');
      }

      const result = batchGenerateService.getBatchResult(batchId);
      if (!result) {
        throw AppError.notFound('批量任务');
      }
      if (result.createdBy !== userId) {
        throw AppError.forbidden('无权访问该批量任务');
      }

      return NextResponse.json({
        success: true,
        batch: result,
      });
    } catch (error: any) {
      console.error('Get batch status error:', error);
      return handleError(error, req.nextUrl.pathname);
    }
  });
}

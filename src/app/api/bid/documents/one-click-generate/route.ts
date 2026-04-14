/**
 * 投标文档一键生成API
 * POST /api/bid/documents/one-click-generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProjectPermission } from '@/lib/auth/project-middleware';
import { parseResourceId } from '@/lib/api/validators';
import { db } from '@/db';
import { bidDocumentInterpretations } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const body = await request.clone().json().catch(() => ({}));
  let projectId: number;
  try {
    projectId = parseResourceId(body.projectId?.toString(), '项目');
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '项目ID格式错误' }, { status: 400 });
  }

  return withProjectPermission(request, projectId, 'edit', async (req, userId) => {
    try {
    const { oneClickGenerateService } = await import('@/lib/services/one-click-generate-service');
    const body = await req.json();
    const {
      projectId,
      documentName,
      interpretationId,
      companyIds,
      partnerApplicationIds,
      generateOptions,
    } = body;

    const projectIdNum = parseResourceId(projectId?.toString(), '项目');
    const interpretationIdNum = parseResourceId(interpretationId?.toString(), '解读');
    const validCompanyIds = Array.isArray(companyIds)
      ? companyIds
          .map((id: any) => Number.parseInt(String(id), 10))
          .filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    // 参数验证
    if (
      !documentName ||
      validCompanyIds.length === 0
    ) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解读结果必须属于当前项目，避免跨项目滥用
    const matchedInterpretation = await db.query.bidDocumentInterpretations.findFirst({
      where: and(
        eq(bidDocumentInterpretations.id, interpretationIdNum),
        eq(bidDocumentInterpretations.projectId, projectIdNum)
      ),
      columns: { id: true },
    });
    if (!matchedInterpretation) {
      return NextResponse.json({ error: '解读结果不存在或不属于当前项目' }, { status: 400 });
    }

    // 构造生成参数
    const params = {
      projectId: projectIdNum,
      documentName,
      interpretationId: interpretationIdNum,
      companyIds: validCompanyIds,
      partnerApplicationIds: partnerApplicationIds || [],
      generateOptions: generateOptions || {
        includeQualification: true,
        includePerformance: true,
        includeTechnical: true,
        includeBusiness: true,
        style: 'formal',
      },
    };

    // 提取自定义请求头（用于Coze SDK认证）
    const customHeaders: Record<string, string> = {};
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      customHeaders['authorization'] = authHeader;
    }
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      customHeaders['x-api-key'] = apiKey;
    }

    // 执行一键生成
    const result = await oneClickGenerateService.generateDocument(
      params,
      userId,
      customHeaders
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('One-click generate error:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
    }
  });
}

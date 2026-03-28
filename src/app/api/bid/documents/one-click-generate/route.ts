/**
 * 投标文档一键生成API
 * POST /api/bid/documents/one-click-generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { oneClickGenerateService } from '@/lib/services/one-click-generate-service';
import { getSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      documentName,
      interpretationId,
      companyIds,
      partnerApplicationIds,
      generateOptions,
    } = body;

    // 参数验证
    if (!projectId || !documentName || !interpretationId || !companyIds || companyIds.length === 0) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 构造生成参数
    const params = {
      projectId,
      documentName,
      interpretationId,
      companyIds,
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
      session.user.id,
      customHeaders
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('One-click generate error:', error);
    return NextResponse.json(
      { error: error.message || '生成失败' },
      { status: 500 }
    );
  }
}

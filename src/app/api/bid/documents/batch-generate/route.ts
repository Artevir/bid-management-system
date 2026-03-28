/**
 * 批量生成投标文档API
 * POST: 批量生成
 * GET: 获取批量任务状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { batchGenerateService } from '@/lib/services/batch-generate-service';
import { getSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { items, generateOptions, parallel, maxParallel } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '请提供要生成的文档列表' },
        { status: 400 }
      );
    }

    // 验证每个item
    for (const item of items) {
      if (!item.projectId || !item.documentName || !item.interpretationId || !item.companyIds) {
        return NextResponse.json(
          { error: '每个生成项必须包含项目ID、文档名称、解读ID和公司ID' },
          { status: 400 }
        );
      }
    }

    // 提取自定义请求头
    const customHeaders: Record<string, string> = {};
    const authHeader = request.headers.get('authorization');
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
      session.user.id,
      customHeaders
    );

    return NextResponse.json({
      success: true,
      batch: result,
    });
  } catch (error: any) {
    console.error('Batch generate error:', error);
    return NextResponse.json(
      { error: error.message || '批量生成失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json(
        { error: '缺少batchId参数' },
        { status: 400 }
      );
    }

    const result = batchGenerateService.getBatchResult(batchId);
    if (!result) {
      return NextResponse.json(
        { error: '批量任务不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      batch: result,
    });
  } catch (error: any) {
    console.error('Get batch status error:', error);
    return NextResponse.json(
      { error: error.message || '获取失败' },
      { status: 500 }
    );
  }
}

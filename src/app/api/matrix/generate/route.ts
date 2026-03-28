/**
 * 响应矩阵生成API
 * POST: 根据解析任务生成响应矩阵
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { generateResponseMatrix, batchGenerateResponses } from '@/lib/matrix/generator';

// 生成响应矩阵
async function generateMatrix(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { projectId, taskId, name, description } = body;

    if (!projectId || !taskId || !name) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 生成响应矩阵
    const result = await generateResponseMatrix({
      projectId,
      taskId,
      name,
      description,
      userId,
      customHeaders,
    });

    return NextResponse.json({
      success: true,
      matrix: {
        id: result.matrixId,
        totalItems: result.totalItems,
        statistics: result.statistics,
      },
      message: '响应矩阵生成成功',
    });
  } catch (error) {
    console.error('Generate matrix error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成响应矩阵失败' },
      { status: 500 }
    );
  }
}

// 批量生成响应建议
async function generateResponses(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { matrixId, itemIds } = body;

    if (!matrixId) {
      return NextResponse.json({ error: '缺少矩阵ID' }, { status: 400 });
    }

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 批量生成响应
    await batchGenerateResponses(matrixId, itemIds || [], customHeaders);

    return NextResponse.json({
      success: true,
      message: '响应建议生成完成',
    });
  } catch (error) {
    console.error('Generate responses error:', error);
    return NextResponse.json({ error: '生成响应建议失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'responses') {
    return withAuth(request, (req, userId) => generateResponses(req, userId));
  }

  return withAuth(request, (req, userId) => generateMatrix(req, userId));
}

/**
 * 解读解析API
 * POST: 执行文件解读解析
 */

import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { getCurrentUser } from '@/lib/auth/jwt';
import { executeInterpretation, getInterpretationById } from '@/lib/interpretation/service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    // 检查解读记录是否存在
    const interpretation = await getInterpretationById(interpretationId);
    if (!interpretation) {
      return NextResponse.json({ error: '解读记录不存在' }, { status: 404 });
    }

    // 检查状态
    if (interpretation.status === 'parsing') {
      return NextResponse.json({ error: '正在解析中，请勿重复操作' }, { status: 400 });
    }

    // 提取请求头用于SDK调用
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 执行解析（异步）
    executeInterpretation(interpretationId, customHeaders).catch(error => {
      console.error('解析任务执行失败:', error);
    });

    return NextResponse.json({
      success: true,
      message: '解析任务已启动',
    });
  } catch (error) {
    console.error('启动解析失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '启动失败' },
      { status: 500 }
    );
  }
}

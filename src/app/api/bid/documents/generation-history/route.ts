/**
 * 文档生成历史API
 * GET: 获取生成历史列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { generationHistoryService } from '@/lib/services/generation-history-service';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const projectId = searchParams.get('projectId');
    const historyId = searchParams.get('historyId');

    // 获取单个历史详情
    if (historyId) {
      const history = await generationHistoryService.getHistoryById(parseInt(historyId));
      if (!history) {
        return NextResponse.json({ error: '历史记录不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, history });
    }

    // 按文档ID获取
    if (documentId) {
      const histories = await generationHistoryService.getHistoriesByDocument(parseInt(documentId));
      return NextResponse.json({ success: true, histories });
    }

    // 按项目ID获取
    if (projectId) {
      const histories = await generationHistoryService.getHistoriesByProject(parseInt(projectId));
      const statistics = await generationHistoryService.getStatistics(parseInt(projectId));
      return NextResponse.json({
        success: true,
        histories,
        statistics,
      });
    }

    return NextResponse.json(
      { error: '请提供documentId或projectId参数' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Get generation history error:', error);
    return NextResponse.json(
      { error: error.message || '获取失败' },
      { status: 500 }
    );
  }
}

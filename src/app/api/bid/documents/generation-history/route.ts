/**
 * 文档生成历史API
 * GET: 获取生成历史列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { generationHistoryService } from '@/lib/services/generation-history-service';
import { withAuth } from '@/lib/auth/middleware';
import { checkResourcePermission } from '@/lib/auth/resource-permission';
import { hasProjectPermission } from '@/lib/project/member';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const projectId = searchParams.get('projectId');
    const historyId = searchParams.get('historyId');

    // 获取单个历史详情
    if (historyId) {
      const historyIdNum = Number.parseInt(historyId, 10);
      if (!Number.isInteger(historyIdNum) || historyIdNum <= 0) {
        return NextResponse.json({ error: 'historyId 参数不合法' }, { status: 400 });
      }

      const history = await generationHistoryService.getHistoryById(historyIdNum);
      if (!history) {
        return NextResponse.json({ error: '历史记录不存在' }, { status: 404 });
      }

      const permission = await checkResourcePermission(userId, 'document', history.documentId, 'read');
      if (!permission.allowed) {
        return NextResponse.json({ error: permission.reason || '权限不足' }, { status: 403 });
      }

      return NextResponse.json({ success: true, history });
    }

    // 按文档ID获取
    if (documentId) {
      const documentIdNum = Number.parseInt(documentId, 10);
      if (!Number.isInteger(documentIdNum) || documentIdNum <= 0) {
        return NextResponse.json({ error: 'documentId 参数不合法' }, { status: 400 });
      }

      const permission = await checkResourcePermission(userId, 'document', documentIdNum, 'read');
      if (!permission.allowed) {
        return NextResponse.json({ error: permission.reason || '权限不足' }, { status: 403 });
      }

      const histories = await generationHistoryService.getHistoriesByDocument(documentIdNum);
      return NextResponse.json({ success: true, histories });
    }

    // 按项目ID获取
    if (projectId) {
      const projectIdNum = Number.parseInt(projectId, 10);
      if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
        return NextResponse.json({ error: 'projectId 参数不合法' }, { status: 400 });
      }

      const hasAccess = await hasProjectPermission(projectIdNum, userId, 'view');
      if (!hasAccess) {
        return NextResponse.json({ error: '无权访问此项目' }, { status: 403 });
      }

      const histories = await generationHistoryService.getHistoriesByProject(projectIdNum);
      const statistics = await generationHistoryService.getStatistics(projectIdNum);
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
  });
}

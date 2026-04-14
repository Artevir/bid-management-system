/**
 * 获取一键生成可用数据源
 * GET /api/bid/documents/data-sources?projectId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProjectPermission } from '@/lib/auth/project-middleware';
import { parseResourceId } from '@/lib/api/validators';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let projectId: number;
  try {
    projectId = parseResourceId(searchParams.get('projectId'), '项目');
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '项目ID格式错误' }, { status: 400 });
  }

  return withProjectPermission(request, projectId, 'view', async () => {
    try {
    const { oneClickGenerateService } = await import('@/lib/services/one-click-generate-service');

    const dataSources = await oneClickGenerateService.getAvailableDataSources(projectId);

    return NextResponse.json({
      success: true,
      data: dataSources,
    });
    } catch (error: any) {
      console.error('Get data sources error:', error);
      return NextResponse.json({ error: error.message || '获取失败' }, { status: 500 });
    }
  });
}

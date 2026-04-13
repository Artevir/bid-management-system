/**
 * 获取一键生成可用数据源
 * GET /api/bid/documents/data-sources?projectId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const { oneClickGenerateService } = await import('@/lib/services/one-click-generate-service');
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const dataSources = await oneClickGenerateService.getAvailableDataSources(parseInt(projectId));

    return NextResponse.json({
      success: true,
      data: dataSources,
    });
  } catch (error: any) {
    console.error('Get data sources error:', error);
    return NextResponse.json({ error: error.message || '获取失败' }, { status: 500 });
  }
}

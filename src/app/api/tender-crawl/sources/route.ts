/**
 * 抓取源管理API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createCrawlSource,
  getCrawlSources,
  getCrawlSourceById as _getCrawlSourceById,
  updateCrawlSource as _updateCrawlSource,
  deleteCrawlSource as _deleteCrawlSource,
} from '@/lib/tender-crawl/service';

// GET /api/tender-crawl/sources - 获取抓取源列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || undefined;
    const isActive = searchParams.get('isActive') === 'true' ? true : 
                     searchParams.get('isActive') === 'false' ? false : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await getCrawlSources({
      type,
      isActive,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取抓取源列表失败:', error);
    return NextResponse.json({ error: '获取抓取源列表失败' }, { status: 500 });
  }
}

// POST /api/tender-crawl/sources - 创建抓取源
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const source = await createCrawlSource({
      name: body.name,
      code: body.code,
      type: body.type,
      baseUrl: body.baseUrl,
      listUrl: body.listUrl,
      detailUrlPattern: body.detailUrlPattern,
      crawlConfig: body.crawlConfig,
      headers: body.headers,
      cookies: body.cookies,
      proxy: body.proxy,
      scheduleType: body.scheduleType || 'manual',
      cronExpression: body.cronExpression,
      intervalMinutes: body.intervalMinutes,
      isActive: body.isActive ?? true,
      createdBy: session.user.id,
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error('创建抓取源失败:', error);
    return NextResponse.json({ error: '创建抓取源失败' }, { status: 500 });
  }
}

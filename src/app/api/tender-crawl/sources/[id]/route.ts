/**
 * 抓取源详情API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getCrawlSourceById,
  updateCrawlSource,
  deleteCrawlSource,
} from '@/lib/tender-crawl/service';

// GET /api/tender-crawl/sources/[id] - 获取抓取源详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const source = await getCrawlSourceById(parseInt(id));

    if (!source) {
      return NextResponse.json({ error: '抓取源不存在' }, { status: 404 });
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error('获取抓取源详情失败:', error);
    return NextResponse.json({ error: '获取抓取源详情失败' }, { status: 500 });
  }
}

// PUT /api/tender-crawl/sources/[id] - 更新抓取源
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const source = await updateCrawlSource(parseInt(id), {
      name: body.name,
      type: body.type,
      baseUrl: body.baseUrl,
      listUrl: body.listUrl,
      detailUrlPattern: body.detailUrlPattern,
      crawlConfig: body.crawlConfig,
      headers: body.headers,
      cookies: body.cookies,
      proxy: body.proxy,
      scheduleType: body.scheduleType,
      cronExpression: body.cronExpression,
      intervalMinutes: body.intervalMinutes,
      isActive: body.isActive,
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error('更新抓取源失败:', error);
    return NextResponse.json({ error: '更新抓取源失败' }, { status: 500 });
  }
}

// DELETE /api/tender-crawl/sources/[id] - 删除抓取源
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    await deleteCrawlSource(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除抓取源失败:', error);
    return NextResponse.json({ error: '删除抓取源失败' }, { status: 500 });
  }
}

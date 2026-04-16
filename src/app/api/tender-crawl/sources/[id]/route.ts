/**
 * 抓取源详情API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth/middleware';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  getCrawlSourceById,
  updateCrawlSource,
  deleteCrawlSource,
} from '@/lib/tender-crawl/service';

// GET /api/tender-crawl/sources/[id] - 获取抓取源详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(req, async (_request) => {
    try {
      const p = await params;
      const source = await getCrawlSourceById(parseIdFromParams(p, 'id', '抓取源'));

      if (!source) {
        return NextResponse.json({ error: '抓取源不存在' }, { status: 404 });
      }

      return NextResponse.json(source);
    } catch (error) {
      console.error('获取抓取源详情失败:', error);
      return NextResponse.json({ error: '获取抓取源详情失败' }, { status: 500 });
    }
  });
}

// PUT /api/tender-crawl/sources/[id] - 更新抓取源
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(req, async (_request) => {
    try {
      const p = await params;
      const sourceId = parseIdFromParams(p, 'id', '抓取源');
      const body = await req.json();

      const source = await updateCrawlSource(sourceId, {
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
  });
}

// DELETE /api/tender-crawl/sources/[id] - 删除抓取源
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(req, async (_request) => {
    try {
      const p = await params;
      await deleteCrawlSource(parseIdFromParams(p, 'id', '抓取源'));

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除抓取源失败:', error);
      return NextResponse.json({ error: '删除抓取源失败' }, { status: 500 });
    }
  });
}

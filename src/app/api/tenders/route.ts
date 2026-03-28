/**
 * 招标信息抓取API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  tenderCrawlService,
  tenderSubscriptionService,
  tenderMatchService,
} from '@/lib/tender/service';

// GET /api/tenders - 获取招标信息
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const path = req.nextUrl.pathname;

    // 获取用户订阅列表
    if (path.endsWith('/subscriptions')) {
      const subscriptions = await tenderSubscriptionService.getUserSubscriptions(session.user.id);
      return NextResponse.json(subscriptions);
    }

    // 获取推荐招标信息
    if (path.endsWith('/recommend')) {
      const limit = parseInt(searchParams.get('limit') || '10');
      const tenders = await tenderMatchService.recommendTenders(session.user.id, limit);
      return NextResponse.json(tenders);
    }

    // 抓取招标信息
    const keyword = searchParams.get('keyword');
    if (keyword) {
      const tenders = await tenderCrawlService.crawlAllSources(keyword);
      return NextResponse.json(tenders);
    }

    return NextResponse.json({ error: '请提供搜索关键词' }, { status: 400 });
  } catch (error) {
    console.error('获取招标信息失败:', error);
    return NextResponse.json({ error: '获取招标信息失败' }, { status: 500 });
  }
}

// POST /api/tenders - 创建订阅或执行操作
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    // 创建订阅
    if (body.action === 'subscribe') {
      const subscription = await tenderSubscriptionService.createSubscription({
        userId: session.user.id,
        name: body.name,
        keywords: body.keywords,
        regions: body.regions,
        industries: body.industries,
        minBudget: body.minBudget,
        maxBudget: body.maxBudget,
      });
      return NextResponse.json(subscription);
    }

    // 匹配招标信息
    if (body.action === 'match' && body.tender) {
      const result = await tenderMatchService.matchProject(body.tender);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('操作失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

// DELETE /api/tenders - 删除订阅
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return NextResponse.json({ error: '缺少订阅ID' }, { status: 400 });
    }

    await tenderSubscriptionService.deleteSubscription(parseInt(subscriptionId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除订阅失败:', error);
    return NextResponse.json({ error: '删除订阅失败' }, { status: 500 });
  }
}

/**
 * 招标信息抓取API路由（兼容旧客户端）
 * 新实现请优先使用：
 * - /api/tender-subscriptions
 * - /api/tender-crawl/tenders
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withAdmin } from '@/lib/auth/middleware';
import { tenderCrawlService, tenderMatchService } from '@/lib/tender/service';
import {
  createSubscription as createPersistedSubscription,
  deleteSubscription as deletePersistedSubscription,
  getSubscriptionById,
} from '@/lib/tender-subscription/service';
import { parseResourceId } from '@/lib/api/validators';

function normalizeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,，\n]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

// GET /api/tenders - 获取招标信息
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const path = req.nextUrl.pathname;
  const keyword = searchParams.get('keyword');

  // 全源抓取：昂贵且可被滥用，仅管理员可用（与 /api/tender-crawl 的职责对齐）
  if (keyword) {
    return withAdmin(req, async () => {
      try {
        const tenders = await tenderCrawlService.crawlAllSources(keyword);
        return NextResponse.json(tenders);
      } catch (error) {
        console.error('获取招标信息失败:', error);
        return NextResponse.json({ error: '获取招标信息失败' }, { status: 500 });
      }
    });
  }

  return withAuth(req, async (_request, userId) => {
    try {
      // 历史分支：pathname 通常不会以 /subscriptions 结尾；保留兼容但不做额外暴露面
      if (path.endsWith('/subscriptions')) {
        return NextResponse.json(
          { error: '已迁移：请使用 GET /api/tender-subscriptions' },
          { status: 410 }
        );
      }

      if (path.endsWith('/recommend')) {
        const limit = parseInt(searchParams.get('limit') || '10');
        const tenders = await tenderMatchService.recommendTenders(userId, limit);
        return NextResponse.json(tenders);
      }

      return NextResponse.json({ error: '请提供搜索关键词' }, { status: 400 });
    } catch (error) {
      console.error('获取招标信息失败:', error);
      return NextResponse.json({ error: '获取招标信息失败' }, { status: 500 });
    }
  });
}

// POST /api/tenders - 创建订阅或执行操作
export async function POST(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const body = await request.json();

      if (body.action === 'subscribe') {
        const keywords = normalizeStringArray(body.keywords) || [];
        const regions = normalizeStringArray(body.regions);
        const industries = normalizeStringArray(body.industries);
        const name =
          typeof body.name === 'string' && body.name.trim()
            ? body.name.trim()
            : `订阅-${keywords[0] || '未命名'}`;

        const subscription = await createPersistedSubscription({
          userId,
          name,
          keywords,
          regions,
          industries,
          budgetMin: body.minBudget != null ? String(body.minBudget) : undefined,
          budgetMax: body.maxBudget != null ? String(body.maxBudget) : undefined,
          isActive: true,
        });

        return NextResponse.json({
          ...subscription,
          industries: subscription.industries ? JSON.parse(subscription.industries) : [],
          regions: subscription.regions ? JSON.parse(subscription.regions) : [],
          procurementMethods: subscription.procurementMethods
            ? JSON.parse(subscription.procurementMethods)
            : [],
          keywords: subscription.keywords ? JSON.parse(subscription.keywords) : [],
          projectTypes: subscription.projectTypes ? JSON.parse(subscription.projectTypes) : [],
          tenderOrganizations: subscription.tenderOrganizations
            ? JSON.parse(subscription.tenderOrganizations)
            : [],
        });
      }

      // 会扫描 projects/competitors 表：仅管理员可用，避免横向信息泄露
      if (body.action === 'match' && body.tender) {
        return withAdmin(request, async () => {
          const result = await tenderMatchService.matchProject(body.tender);
          return NextResponse.json(result);
        });
      }

      return NextResponse.json({ error: '未知操作' }, { status: 400 });
    } catch (error) {
      console.error('操作失败:', error);
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: '操作失败' }, { status: 500 });
    }
  });
}

// DELETE /api/tenders - 删除订阅
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const subscriptionIdRaw = searchParams.get('subscriptionId');
      const subscriptionId = parseResourceId(subscriptionIdRaw, '订阅');

      const subscription = await getSubscriptionById(subscriptionId);
      if (!subscription) {
        return NextResponse.json({ error: '订阅不存在' }, { status: 404 });
      }
      if (subscription.userId !== userId) {
        return NextResponse.json({ error: '无权删除此订阅' }, { status: 403 });
      }

      await deletePersistedSubscription(subscriptionId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除订阅失败:', error);
      return NextResponse.json({ error: '删除订阅失败' }, { status: 500 });
    }
  });
}

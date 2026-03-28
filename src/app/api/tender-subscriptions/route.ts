/**
 * 招标信息订阅API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  type CreateSubscriptionParams,
  type UpdateSubscriptionParams,
} from '@/lib/tender-subscription/service';

// GET /api/tender-subscriptions - 获取订阅列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    const filters = {
      userId: session.user.id, // 只能查看自己的订阅
      isActive: searchParams.get('isActive') === 'true' ? true : 
                searchParams.get('isActive') === 'false' ? false : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    };

    const result = await getSubscriptions(filters);

    // 解析JSON字段
    const data = result.data.map(sub => ({
      ...sub,
      industries: sub.industries ? JSON.parse(sub.industries) : [],
      regions: sub.regions ? JSON.parse(sub.regions) : [],
      procurementMethods: sub.procurementMethods ? JSON.parse(sub.procurementMethods) : [],
      keywords: sub.keywords ? JSON.parse(sub.keywords) : [],
      projectTypes: sub.projectTypes ? JSON.parse(sub.projectTypes) : [],
      tenderOrganizations: sub.tenderOrganizations ? JSON.parse(sub.tenderOrganizations) : [],
    }));

    return NextResponse.json({ data, total: result.total });
  } catch (error) {
    console.error('获取订阅列表失败:', error);
    return NextResponse.json({ error: '获取订阅列表失败' }, { status: 500 });
  }
}

// POST /api/tender-subscriptions - 创建订阅
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const params: CreateSubscriptionParams = {
      name: body.name,
      userId: session.user.id,
      industries: body.industries || [],
      regions: body.regions || [],
      procurementMethods: body.procurementMethods || [],
      keywords: body.keywords || [],
      budgetMin: body.budgetMin,
      budgetMax: body.budgetMax,
      projectTypes: body.projectTypes || [],
      tenderOrganizations: body.tenderOrganizations || [],
      isActive: body.isActive ?? true,
    };

    const subscription = await createSubscription(params);

    return NextResponse.json({
      ...subscription,
      industries: subscription.industries ? JSON.parse(subscription.industries) : [],
      regions: subscription.regions ? JSON.parse(subscription.regions) : [],
      procurementMethods: subscription.procurementMethods ? JSON.parse(subscription.procurementMethods) : [],
      keywords: subscription.keywords ? JSON.parse(subscription.keywords) : [],
      projectTypes: subscription.projectTypes ? JSON.parse(subscription.projectTypes) : [],
      tenderOrganizations: subscription.tenderOrganizations ? JSON.parse(subscription.tenderOrganizations) : [],
    });
  } catch (error) {
    console.error('创建订阅失败:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: '创建订阅失败' }, { status: 500 });
  }
}

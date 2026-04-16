/**
 * 招标信息订阅详情API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  type UpdateSubscriptionParams,
} from '@/lib/tender-subscription/service';
import { parseIdFromParams } from '@/lib/api/validators';

// GET /api/tender-subscriptions/[id] - 获取订阅详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const subscriptionId = parseIdFromParams(p, 'id', '订阅');

      const subscription = await getSubscriptionById(subscriptionId);

      if (!subscription) {
        return NextResponse.json({ error: '订阅不存在' }, { status: 404 });
      }

      if (subscription.userId !== userId) {
        return NextResponse.json({ error: '无权访问此订阅' }, { status: 403 });
      }

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
    } catch (error) {
      console.error('获取订阅详情失败:', error);
      return NextResponse.json({ error: '获取订阅详情失败' }, { status: 500 });
    }
  });
}

// PUT /api/tender-subscriptions/[id] - 更新订阅
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const subscriptionId = parseIdFromParams(p, 'id', '订阅');

      const subscription = await getSubscriptionById(subscriptionId);
      if (!subscription) {
        return NextResponse.json({ error: '订阅不存在' }, { status: 404 });
      }
      if (subscription.userId !== userId) {
        return NextResponse.json({ error: '无权修改此订阅' }, { status: 403 });
      }

      const body = await req.json();

      const updateData: UpdateSubscriptionParams = {
        name: body.name,
        industries: body.industries,
        regions: body.regions,
        procurementMethods: body.procurementMethods,
        keywords: body.keywords,
        budgetMin: body.budgetMin,
        budgetMax: body.budgetMax,
        projectTypes: body.projectTypes,
        tenderOrganizations: body.tenderOrganizations,
        isActive: body.isActive,
      };

      const updated = await updateSubscription(subscriptionId, updateData);

      return NextResponse.json({
        ...updated,
        industries: updated.industries ? JSON.parse(updated.industries) : [],
        regions: updated.regions ? JSON.parse(updated.regions) : [],
        procurementMethods: updated.procurementMethods
          ? JSON.parse(updated.procurementMethods)
          : [],
        keywords: updated.keywords ? JSON.parse(updated.keywords) : [],
        projectTypes: updated.projectTypes ? JSON.parse(updated.projectTypes) : [],
        tenderOrganizations: updated.tenderOrganizations
          ? JSON.parse(updated.tenderOrganizations)
          : [],
      });
    } catch (error) {
      console.error('更新订阅失败:', error);
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: '更新订阅失败' }, { status: 500 });
    }
  });
}

// DELETE /api/tender-subscriptions/[id] - 删除订阅
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const subscriptionId = parseIdFromParams(p, 'id', '订阅');

      const subscription = await getSubscriptionById(subscriptionId);
      if (!subscription) {
        return NextResponse.json({ error: '订阅不存在' }, { status: 404 });
      }
      if (subscription.userId !== userId) {
        return NextResponse.json({ error: '无权删除此订阅' }, { status: 403 });
      }

      await deleteSubscription(subscriptionId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除订阅失败:', error);
      return NextResponse.json({ error: '删除订阅失败' }, { status: 500 });
    }
  });
}

/**
 * 材料交付记录API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getDeliveries,
  createDelivery,
  updateDelivery as _updateDelivery,
} from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import { canAccessAuthorizationApplication } from '@/lib/support/application-access';

// GET - 获取交付记录列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const deliveries = await getDeliveries(applicationId);
      return NextResponse.json(deliveries);
    } catch (error) {
      console.error('获取交付记录列表失败:', error);
      return NextResponse.json({ error: '获取交付记录列表失败' }, { status: 500 });
    }
  });
}

// POST - 创建交付记录
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const body = await request.json();

      const delivery = await createDelivery({
        applicationId,
        materialTypes: body.materialTypes,
        deliveryMethod: body.deliveryMethod,
        shippingMethod: body.shippingMethod,
        trackingNumber: body.trackingNumber,
        customShippingMethod: body.customShippingMethod,
        deliveredAt: body.deliveredAt ? new Date(body.deliveredAt) : undefined,
        receiverName: body.receiverName,
        receiverSignature: body.receiverSignature,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
        logisticsVoucherFileId: body.logisticsVoucherFileId,
        receiptVoucherFileId: body.receiptVoucherFileId,
        createdBy: userId,
      });

      return NextResponse.json(delivery);
    } catch (error) {
      console.error('创建交付记录失败:', error);
      return NextResponse.json({ error: '创建交付记录失败' }, { status: 500 });
    }
  });
}

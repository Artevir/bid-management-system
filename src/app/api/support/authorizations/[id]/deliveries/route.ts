/**
 * 材料交付记录API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getDeliveries,
  createDelivery,
  updateDelivery as _updateDelivery,
} from '@/lib/authorization/service';

// GET - 获取交付记录列表
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
    const applicationId = parseInt(id);
    const deliveries = await getDeliveries(applicationId);

    return NextResponse.json(deliveries);
  } catch (error) {
    console.error('获取交付记录列表失败:', error);
    return NextResponse.json({ error: '获取交付记录列表失败' }, { status: 500 });
  }
}

// POST - 创建交付记录
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const body = await req.json();

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
      createdBy: session.user.id,
    });

    return NextResponse.json(delivery);
  } catch (error) {
    console.error('创建交付记录失败:', error);
    return NextResponse.json({ error: '创建交付记录失败' }, { status: 500 });
  }
}

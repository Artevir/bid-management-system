/**
 * 友司费用API路由
 * GET /api/support/partner-applications/[id]/fees - 获取费用列表
 * POST /api/support/partner-applications/[id]/fees - 创建费用
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getPartnerFees,
  createPartnerFee,
} from '@/lib/partner-application/service';

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

    const fees = await getPartnerFees(applicationId);
    return NextResponse.json(fees);
  } catch (error) {
    console.error('获取友司费用失败:', error);
    return NextResponse.json({ error: '获取友司费用失败' }, { status: 500 });
  }
}

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

    const fee = await createPartnerFee({
      applicationId,
      feeType: body.feeType,
      feeName: body.feeName,
      defaultAmount: body.defaultAmount,
      actualAmount: body.actualAmount,
      notes: body.notes,
      paymentStatus: body.paymentStatus,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json(fee);
  } catch (error) {
    console.error('创建友司费用失败:', error);
    return NextResponse.json({ error: '创建友司费用失败' }, { status: 500 });
  }
}

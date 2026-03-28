/**
 * 单个费用API路由
 * PUT /api/support/partner-applications/[id]/fees/[feeId] - 更新费用
 * DELETE /api/support/partner-applications/[id]/fees/[feeId] - 删除费用
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  updatePartnerFee,
  deletePartnerFee,
} from '@/lib/partner-application/service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { feeId } = await params;
    const id = parseInt(feeId);
    const body = await req.json();

    const fee = await updatePartnerFee(id, {
      feeType: body.feeType,
      feeName: body.feeName,
      defaultAmount: body.defaultAmount,
      actualAmount: body.actualAmount,
      notes: body.notes,
      paymentStatus: body.paymentStatus,
    });

    return NextResponse.json(fee);
  } catch (error) {
    console.error('更新友司费用失败:', error);
    return NextResponse.json({ error: '更新友司费用失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { feeId } = await params;
    const id = parseInt(feeId);

    await deletePartnerFee(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除友司费用失败:', error);
    return NextResponse.json({ error: '删除友司费用失败' }, { status: 500 });
  }
}

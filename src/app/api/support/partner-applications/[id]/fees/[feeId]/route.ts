/**
 * 单个费用API路由
 * PUT /api/support/partner-applications/[id]/fees/[feeId] - 更新费用
 * DELETE /api/support/partner-applications/[id]/fees/[feeId] - 删除费用
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { updatePartnerFee, deletePartnerFee } from '@/lib/partner-application/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  assertPartnerFeeBelongs,
  canAccessPartnerApplication,
} from '@/lib/support/application-access';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const feeId = parseIdFromParams(p, 'feeId', '费用');

      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertPartnerFeeBelongs(applicationId, feeId);
      if (!belongs) {
        return NextResponse.json({ error: '费用不属于该申请' }, { status: 400 });
      }

      const body = await request.json();

      const fee = await updatePartnerFee(feeId, {
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
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const feeId = parseIdFromParams(p, 'feeId', '费用');

      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertPartnerFeeBelongs(applicationId, feeId);
      if (!belongs) {
        return NextResponse.json({ error: '费用不属于该申请' }, { status: 400 });
      }

      await deletePartnerFee(feeId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除友司费用失败:', error);
      return NextResponse.json({ error: '删除友司费用失败' }, { status: 500 });
    }
  });
}

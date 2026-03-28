/**
 * 退还保证金审批API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getGuaranteeById,
  approveReturn,
  completeReturn,
  rejectReturn,
} from '@/lib/guarantee/service';

// POST - 审批退还申请（通过或拒绝）
async function approveReturnRequest(
  request: NextRequest,
  userId: number,
  guaranteeId: number
): Promise<NextResponse> {
  try {
    const guarantee = await getGuaranteeById(guaranteeId);
    if (!guarantee) {
      return NextResponse.json(
        { success: false, error: '保证金记录不存在' },
        { status: 404 }
      );
    }

    // 检查退还状态
    if (!['applied', 'processing'].includes(guarantee.returnStatus || '')) {
      return NextResponse.json(
        { success: false, error: '该保证金未申请退还或已在处理中' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const action = body.action; // 'approve', 'complete', 'reject'

    let result;
    if (action === 'approve') {
      // 审批通过，进入处理中状态
      result = await approveReturn(guaranteeId, {
        handlerId: userId,
        handlerName: body.handlerName || '',
      });
    } else if (action === 'complete') {
      // 完成退还
      result = await completeReturn(guaranteeId, {
        returnDate: body.returnDate ? new Date(body.returnDate) : new Date(),
        returnAmount: body.returnAmount,
        returnVoucher: body.returnVoucher,
      });
    } else if (action === 'reject') {
      // 拒绝退还
      result = await rejectReturn(guaranteeId, body.reason || '审批不通过');
    } else {
      return NextResponse.json(
        { success: false, error: '无效的操作' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: action === 'approve' ? '已审批通过' : action === 'complete' ? '退还已完成' : '已拒绝退还',
    });
  } catch (error) {
    console.error('Failed to approve return:', error);
    return NextResponse.json(
      { success: false, error: '审批操作失败' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => approveReturnRequest(req, userId, parseInt(id)));
}

/**
 * 退还保证金申请API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getGuaranteeById,
  applyForReturn,
  approveReturn,
  completeReturn,
  rejectReturn,
} from '@/lib/guarantee/service';

// POST - 申请退还保证金
async function applyReturn(
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

    // 只有已缴纳的保证金才能申请退还
    if (guarantee.status !== 'paid') {
      return NextResponse.json(
        { success: false, error: '只有已缴纳的保证金才能申请退还' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updated = await applyForReturn(guaranteeId, {
      returnAmount: body.returnAmount,
      returnReason: body.returnReason,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: '退还申请已提交',
    });
  } catch (error) {
    console.error('Failed to apply for return:', error);
    return NextResponse.json(
      { success: false, error: '提交退还申请失败' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => applyReturn(req, userId, parseInt(id)));
}

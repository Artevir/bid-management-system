/**
 * 保证金缴纳API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { markAsPaid } from '@/lib/guarantee/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await req.json();

    const guarantee = await markAsPaid(id, {
      paymentDate: new Date(body.paymentDate || new Date()),
      paymentVoucher: body.paymentVoucher,
      paymentMethod: body.paymentMethod,
    });

    return NextResponse.json(guarantee);
  } catch (error) {
    console.error('标记缴纳失败:', error);
    return NextResponse.json({ error: '标记缴纳失败' }, { status: 500 });
  }
}

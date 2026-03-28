/**
 * 保证金退还API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { markAsReturned } from '@/lib/guarantee/service';

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

    const guarantee = await markAsReturned(id, {
      returnDate: new Date(body.returnDate || new Date()),
      returnAmount: body.returnAmount,
      returnVoucher: body.returnVoucher,
      returnReason: body.returnReason,
    });

    return NextResponse.json(guarantee);
  } catch (error) {
    console.error('标记退还失败:', error);
    return NextResponse.json({ error: '标记退还失败' }, { status: 500 });
  }
}

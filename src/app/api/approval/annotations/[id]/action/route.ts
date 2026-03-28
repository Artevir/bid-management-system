/**
 * 批注操作 API（解决/忽略）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { resolveAnnotation, dismissAnnotation } from '@/lib/approval/annotation';

// 解决/忽略批注
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'resolve') {
      await resolveAnnotation(parseInt(id), authResult.user!.id);
      return NextResponse.json({ success: true, message: '问题已解决' });
    }

    if (action === 'dismiss') {
      await dismissAnnotation(parseInt(id), authResult.user!.id);
      return NextResponse.json({ success: true, message: '问题已忽略' });
    }

    return NextResponse.json({ error: '无效操作' }, { status: 400 });
  } catch (error) {
    console.error('批注操作失败:', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

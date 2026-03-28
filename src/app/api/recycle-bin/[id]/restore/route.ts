/**
 * 回收站恢复API
 * POST: 从回收站恢复资源
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { restoreFromRecycleBin } from '@/lib/recycle-bin/service';

// 恢复资源
async function restore(
  request: NextRequest,
  userId: number,
  recycleBinId: number
): Promise<NextResponse> {
  try {
    const result = await restoreFromRecycleBin(recycleBinId, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: { resourceId: result.resourceId },
    });
  } catch (error) {
    console.error('Restore from recycle bin error:', error);
    return NextResponse.json({ error: '恢复失败' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => restore(req, userId, parseInt(id)));
}

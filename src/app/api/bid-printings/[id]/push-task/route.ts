/**
 * 推送打印标书安排到任务中心
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  pushToTaskCenter,
  cancelPushToTaskCenter,
} from '@/lib/bid-printing/service';

// POST - 推送到任务中心
async function pushToTask(
  request: NextRequest,
  userId: number,
  printingId: number
): Promise<NextResponse> {
  try {
    const result = await pushToTaskCenter(printingId, userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        printing: result.printing,
        task: result.task,
      },
      message: '已成功推送到任务中心',
    });
  } catch (error) {
    console.error('Failed to push printing to task center:', error);
    return NextResponse.json(
      { success: false, error: '推送到任务中心失败' },
      { status: 500 }
    );
  }
}

// DELETE - 取消推送到任务中心
async function cancelPush(
  request: NextRequest,
  userId: number,
  printingId: number
): Promise<NextResponse> {
  try {
    const result = await cancelPushToTaskCenter(printingId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.printing,
      message: '已取消推送到任务中心',
    });
  } catch (error) {
    console.error('Failed to cancel push to task center:', error);
    return NextResponse.json(
      { success: false, error: '取消推送失败' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => pushToTask(req, userId, parseInt(id)));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => cancelPush(req, userId, parseInt(id)));
}

/**
 * 推送盖章申请到任务中心API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { pushToTaskCenter } from '@/lib/bid-seal/service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req, userId) => {
    try {
      const { id } = await params;
      const applicationId = parseInt(id);
      
      if (isNaN(applicationId)) {
        return NextResponse.json(
          { success: false, error: '无效的盖章申请ID' },
          { status: 400 }
        );
      }
      
      const result = await pushToTaskCenter(applicationId, userId);
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: '已推送到任务中心',
        taskId: result.taskId,
      });
    } catch (error) {
      console.error('Failed to push seal application to task center:', error);
      return NextResponse.json(
        { success: false, error: '推送到任务中心失败' },
        { status: 500 }
      );
    }
  });
}

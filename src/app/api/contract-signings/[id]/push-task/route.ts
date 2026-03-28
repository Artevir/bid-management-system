/**
 * 合同签订推送任务API路由
 * POST /api/contract-signings/[id]/push-task - 推送到任务中心
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pushContractSigningToTask } from '@/lib/contract-signing/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = await pushContractSigningToTask(parseInt(id), session.user.id);

    return NextResponse.json({ success: true, taskId });
  } catch (error) {
    console.error('推送任务失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '推送任务失败' },
      { status: 500 }
    );
  }
}

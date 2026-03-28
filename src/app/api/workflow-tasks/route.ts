/**
 * 工作流任务 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getTodoTaskList, getDoneTaskList, getUserTaskStats } from '@/lib/workflow/service';

// 获取任务列表
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'todo'; // todo | done | stats

    // 获取统计信息
    if (type === 'stats') {
      const stats = await getUserTaskStats(user.userId);
      return NextResponse.json(stats);
    }

    const params = {
      assigneeId: user.userId,
      status: searchParams.get('status') || undefined,
      businessType: searchParams.get('businessType') || undefined,
      priority: searchParams.get('priority') ? parseInt(searchParams.get('priority')!) : undefined,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    };

    // 获取待办或已办列表
    const result = type === 'done' 
      ? await getDoneTaskList(params) 
      : await getTodoTaskList(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return NextResponse.json(
      { error: '获取任务列表失败' },
      { status: 500 }
    );
  }
}

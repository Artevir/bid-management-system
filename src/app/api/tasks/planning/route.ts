/**
 * 智能任务规划API路由
 * GET /api/tasks/planning/interpretations - 获取可用的文件解读列表
 * POST /api/tasks/planning/generate - 生成任务分解计划
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getAvailableInterpretations,
  generateTaskPlan,
  getInterpretationForPlanning as _getInterpretationForPlanning,
} from '@/lib/task-planning/service';

// GET - 获取可用的文件解读列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;

    const interpretations = await getAvailableInterpretations(projectId);
    return NextResponse.json(interpretations);
  } catch (error) {
    console.error('获取文件解读列表失败:', error);
    return NextResponse.json({ error: '获取文件解读列表失败' }, { status: 500 });
  }
}

// POST - 生成任务分解计划
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { interpretationId, projectId, additionalContext } = body;

    if (!interpretationId) {
      return NextResponse.json({ error: '请选择要解析的招标文件' }, { status: 400 });
    }

    const result = await generateTaskPlan({
      interpretationId,
      projectId,
      additionalContext,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('生成任务计划失败:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '生成任务计划失败' 
    }, { status: 500 });
  }
}

/**
 * 开标记录管理API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createOpening,
  getOpenings,
  getOpeningById,
  updateOpening,
  deleteOpening,
  getOpeningStatistics,
  getCompetitorWinRate,
  getUpcomingOpenings,
} from '@/lib/opening/service';

// GET /api/openings - 获取开标记录列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 特殊路由处理
    const path = req.nextUrl.pathname;
    if (path.endsWith('/statistics')) {
      const stats = await getOpeningStatistics(projectId);
      return NextResponse.json(stats);
    }
    if (path.endsWith('/competitor-win-rate')) {
      const result = await getCompetitorWinRate();
      return NextResponse.json(result);
    }
    if (path.endsWith('/upcoming')) {
      const days = parseInt(searchParams.get('days') || '7');
      const openings = await getUpcomingOpenings(days);
      return NextResponse.json(openings);
    }

    const result = await getOpenings({
      projectId,
      status,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取开标记录列表失败:', error);
    return NextResponse.json({ error: '获取开标记录列表失败' }, { status: 500 });
  }
}

// POST /api/openings - 创建开标记录
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const opening = await createOpening({
      projectId: body.projectId,
      projectName: body.projectName,
      tenderCode: body.tenderCode,
      openingDate: new Date(body.openingDate),
      openingLocation: body.openingLocation,
      ourBidPrice: body.ourBidPrice,
      ourScore: body.ourScore,
      budgetPrice: body.budgetPrice,
      notes: body.notes,
      status: 'pending',
      createdBy: session.user.id,
    });

    return NextResponse.json(opening);
  } catch (error) {
    console.error('创建开标记录失败:', error);
    return NextResponse.json({ error: '创建开标记录失败' }, { status: 500 });
  }
}

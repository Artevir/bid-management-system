/**
 * 单个开标记录API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getOpeningById,
  updateOpening,
  deleteOpening,
} from '@/lib/opening/service';

// GET /api/openings/[id] - 获取开标记录详情
export async function GET(
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
    const opening = await getOpeningById(id);

    if (!opening) {
      return NextResponse.json({ error: '开标记录不存在' }, { status: 404 });
    }

    return NextResponse.json(opening);
  } catch (error) {
    console.error('获取开标记录详情失败:', error);
    return NextResponse.json({ error: '获取开标记录详情失败' }, { status: 500 });
  }
}

// PATCH /api/openings/[id] - 更新开标记录
export async function PATCH(
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

    const opening = await updateOpening(id, {
      openingDate: body.openingDate ? new Date(body.openingDate) : undefined,
      openingLocation: body.openingLocation,
      ourBidPrice: body.ourBidPrice,
      ourScore: body.ourScore,
      budgetPrice: body.budgetPrice,
      analysis: body.analysis,
      lessonsLearned: body.lessonsLearned,
      notes: body.notes,
    });

    return NextResponse.json(opening);
  } catch (error) {
    console.error('更新开标记录失败:', error);
    return NextResponse.json({ error: '更新开标记录失败' }, { status: 500 });
  }
}

// DELETE /api/openings/[id] - 删除开标记录
export async function DELETE(
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
    await deleteOpening(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除开标记录失败:', error);
    return NextResponse.json({ error: '删除开标记录失败' }, { status: 500 });
  }
}

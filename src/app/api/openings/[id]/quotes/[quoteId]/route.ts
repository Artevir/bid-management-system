/**
 * 单个报价记录API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getOpeningQuoteById,
  updateOpeningQuote,
  deleteOpeningQuote,
} from '@/lib/opening/service';

// GET /api/openings/[id]/quotes/[quoteId] - 获取单条报价
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { quoteId } = await params;
    const id = parseInt(quoteId);
    const quote = await getOpeningQuoteById(id);

    if (!quote) {
      return NextResponse.json({ error: '报价记录不存在' }, { status: 404 });
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error('获取报价详情失败:', error);
    return NextResponse.json({ error: '获取报价详情失败' }, { status: 500 });
  }
}

// PATCH /api/openings/[id]/quotes/[quoteId] - 更新报价记录
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { quoteId } = await params;
    const id = parseInt(quoteId);
    const body = await req.json();

    const quote = await updateOpeningQuote(id, {
      bidderName: body.bidderName,
      bidderType: body.bidderType,
      competitorId: body.competitorId,
      bidPrice: body.bidPrice,
      score: body.score,
      rank: body.rank,
      isWinner: body.isWinner,
      notes: body.notes,
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error('更新报价记录失败:', error);
    return NextResponse.json({ error: '更新报价记录失败' }, { status: 500 });
  }
}

// DELETE /api/openings/[id]/quotes/[quoteId] - 删除报价记录
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { quoteId } = await params;
    const id = parseInt(quoteId);
    await deleteOpeningQuote(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除报价记录失败:', error);
    return NextResponse.json({ error: '删除报价记录失败' }, { status: 500 });
  }
}

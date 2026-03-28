/**
 * 开标报价对比API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  addOpeningQuote,
  getOpeningQuotes,
  batchAddOpeningQuotes,
} from '@/lib/opening/service';

// GET /api/openings/[id]/quotes - 获取报价列表
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
    const openingId = parseInt(idParam);
    const quotes = await getOpeningQuotes(openingId);

    return NextResponse.json(quotes);
  } catch (error) {
    console.error('获取报价列表失败:', error);
    return NextResponse.json({ error: '获取报价列表失败' }, { status: 500 });
  }
}

// POST /api/openings/[id]/quotes - 添加报价记录
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const openingId = parseInt(idParam);
    const body = await req.json();

    // 批量添加
    if (body.quotes && Array.isArray(body.quotes)) {
      const quotes = await batchAddOpeningQuotes(openingId, body.quotes);
      return NextResponse.json(quotes);
    }

    // 单个添加
    const quote = await addOpeningQuote({
      openingId,
      bidderName: body.bidderName,
      bidderType: body.bidderType,
      competitorId: body.competitorId,
      bidPrice: body.bidPrice,
      score: body.score,
      rank: body.rank,
      isWinner: body.isWinner || false,
      notes: body.notes,
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error('添加报价记录失败:', error);
    return NextResponse.json({ error: '添加报价记录失败' }, { status: 500 });
  }
}

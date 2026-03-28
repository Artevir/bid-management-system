/**
 * 解析项详情API
 * GET: 获取解析项详情
 * PUT: 确认/修正解析项
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { confirmParseItem } from '@/lib/parse/service';
import { db } from '@/db';
import { parseItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 获取解析项详情
async function getItem(
  request: NextRequest,
  userId: number,
  itemId: number
): Promise<NextResponse> {
  try {
    const item = await db
      .select()
      .from(parseItems)
      .where(eq(parseItems.id, itemId))
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: '解析项不存在' }, { status: 404 });
    }

    return NextResponse.json({
      ...item[0],
      extraData: item[0].extraData ? JSON.parse(item[0].extraData) : null,
    });
  } catch (error) {
    console.error('Get parse item error:', error);
    return NextResponse.json({ error: '获取解析项详情失败' }, { status: 500 });
  }
}

// 确认/修正解析项
async function confirmItem(
  request: NextRequest,
  userId: number,
  itemId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { correctedContent } = body;

    await confirmParseItem(itemId, userId, correctedContent);

    return NextResponse.json({
      success: true,
      message: '解析项已确认',
    });
  } catch (error) {
    console.error('Confirm parse item error:', error);
    return NextResponse.json({ error: '确认解析项失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getItem(req, userId, parseInt(id)));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => confirmItem(req, userId, parseInt(id)));
}

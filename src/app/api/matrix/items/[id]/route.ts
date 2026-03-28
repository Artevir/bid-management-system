/**
 * 矩阵项API
 * GET: 获取矩阵项详情
 * PUT: 更新矩阵项响应
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { responseItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 获取矩阵项详情
async function getItem(
  request: NextRequest,
  userId: number,
  itemId: number
): Promise<NextResponse> {
  try {
    const item = await db
      .select()
      .from(responseItems)
      .where(eq(responseItems.id, itemId))
      .limit(1);

    if (item.length === 0) {
      return NextResponse.json({ error: '矩阵项不存在' }, { status: 404 });
    }

    return NextResponse.json(item[0]);
  } catch (error) {
    console.error('Get matrix item error:', error);
    return NextResponse.json({ error: '获取矩阵项失败' }, { status: 500 });
  }
}

// 更新矩阵项响应
async function updateItem(
  request: NextRequest,
  userId: number,
  itemId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { response, responseStatus } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (response !== undefined) {
      updateData.response = response;
      updateData.responseStatus = 'responded';
    }

    if (responseStatus) {
      updateData.responseStatus = responseStatus;
    }

    await db
      .update(responseItems)
      .set(updateData)
      .where(eq(responseItems.id, itemId));

    return NextResponse.json({
      success: true,
      message: '矩阵项更新成功',
    });
  } catch (error) {
    console.error('Update matrix item error:', error);
    return NextResponse.json({ error: '更新矩阵项失败' }, { status: 500 });
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
  return withAuth(request, (req, userId) => updateItem(req, userId, parseInt(id)));
}

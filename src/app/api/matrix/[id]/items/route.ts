/**
 * 响应矩阵项API
 * GET: 获取矩阵项列表
 * POST: 创建矩阵项
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { responseItems, responseMatrices } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// 获取矩阵项列表
async function getItems(
  request: NextRequest,
  userId: number,
  matrixId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const responseStatus = searchParams.get('status');

    // 构建查询条件
    const conditions = [eq(responseItems.matrixId, matrixId)];
    
    if (type) {
      conditions.push(eq(responseItems.type, type));
    }
    
    if (responseStatus) {
      conditions.push(eq(responseItems.responseStatus, responseStatus));
    }

    const items = await db
      .select()
      .from(responseItems)
      .where(and(...conditions));

    // 按类型和状态分组统计
    const stats = {
      total: items.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      completed: items.filter((i) => i.responseStatus === 'reviewed').length,
    };

    items.forEach((item) => {
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
      stats.byStatus[item.responseStatus || 'pending'] = (stats.byStatus[item.responseStatus || 'pending'] || 0) + 1;
    });

    return NextResponse.json({
      items,
      stats,
    });
  } catch (error) {
    console.error('Get matrix items error:', error);
    return NextResponse.json({ error: '获取矩阵项列表失败' }, { status: 500 });
  }
}

// 创建矩阵项
async function createItem(
  request: NextRequest,
  userId: number,
  matrixId: number
): Promise<NextResponse> {
  try {
    // 检查矩阵是否存在
    const matrix = await db
      .select()
      .from(responseMatrices)
      .where(eq(responseMatrices.id, matrixId))
      .limit(1);

    if (matrix.length === 0) {
      return NextResponse.json({ error: '响应矩阵不存在' }, { status: 404 });
    }

    const body = await request.json();
    const {
      type,
      title,
      requirement,
      response,
      score,
      serialNumber,
      requirementType,
      parseItemId,
    } = body;

    if (!type || !title) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const [item] = await db
      .insert(responseItems)
      .values({
        matrixId,
        type,
        title,
        requirement: requirement || null,
        response: response || null,
        score: score || null,
        serialNumber: serialNumber || null,
        requirementType: requirementType || null,
        parseItemId: parseItemId || null,
        responseStatus: 'pending',
        assigneeId: null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      item,
      message: '矩阵项创建成功',
    });
  } catch (error) {
    console.error('Create matrix item error:', error);
    return NextResponse.json({ error: '创建矩阵项失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getItems(req, userId, parseInt(id)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => createItem(req, userId, parseInt(id)));
}

/**
 * 解析项API
 * GET: 获取解析项列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getParseItems, confirmParseItem as _confirmParseItem, ParseItemType } from '@/lib/parse/service';

// 获取解析项列表
async function getItems(
  request: NextRequest,
  userId: number,
  taskId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as ParseItemType | null;
    const lowConfidenceOnly = searchParams.get('lowConfidence') === 'true';

    const items = await getParseItems(taskId, type || undefined, lowConfidenceOnly);

    // 按类型分组统计
    const stats = {
      total: items.length,
      byType: {} as Record<string, number>,
      lowConfidence: items.filter((i) => i.isLowConfidence).length,
      confirmed: items.filter((i) => i.isConfirmed).length,
    };

    items.forEach((item) => {
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
    });

    return NextResponse.json({
      items,
      stats,
    });
  } catch (error) {
    console.error('Get parse items error:', error);
    return NextResponse.json({ error: '获取解析项列表失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getItems(req, userId, parseInt(id)));
}

/**
 * 评分细则API
 * GET: 获取评分细则列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getScoringItems } from '@/lib/interpretation/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;

    const items = await getScoringItems(interpretationId, category);

    // 计算各分类分值统计
    const stats = {
      total: items.reduce((sum, item) => sum + item.maxScore, 0),
      business: items
        .filter(item => item.scoringCategory === '商务')
        .reduce((sum, item) => sum + item.maxScore, 0),
      technical: items
        .filter(item => item.scoringCategory === '技术')
        .reduce((sum, item) => sum + item.maxScore, 0),
      price: items
        .filter(item => item.scoringCategory === '报价')
        .reduce((sum, item) => sum + item.maxScore, 0),
    };

    return NextResponse.json({
      success: true,
      data: items,
      stats,
    });
  } catch (error) {
    console.error('获取评分细则失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

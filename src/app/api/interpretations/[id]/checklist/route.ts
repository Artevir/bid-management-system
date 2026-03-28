/**
 * 核对清单API
 * GET: 获取核对清单
 * POST: 创建核对清单项
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getChecklist, createChecklistItem } from '@/lib/interpretation/service';

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

    const items = await getChecklist(interpretationId, category);

    // 计算核对进度
    const stats = {
      total: items.length,
      compliant: items.filter(item => item.checkStatus === 'compliant').length,
      nonCompliant: items.filter(item => item.checkStatus === 'non_compliant').length,
      pending: items.filter(item => item.checkStatus === 'pending').length,
    };

    return NextResponse.json({
      success: true,
      data: items,
      stats,
    });
  } catch (error) {
    console.error('获取核对清单失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const body = await request.json();
    const { checklistCategory, checklistSubCategory, itemName, itemDescription, requirementDetail, isMandatory, originalText, pageNumber } = body;

    if (!checklistCategory || !itemName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const itemId = await createChecklistItem(
      interpretationId,
      {
        checklistCategory,
        checklistSubCategory,
        itemName,
        itemDescription,
        requirementDetail,
        isMandatory,
        originalText,
        pageNumber,
      },
      user.userId
    );

    return NextResponse.json({
      success: true,
      data: { id: itemId },
      message: '创建成功',
    });
  } catch (error) {
    console.error('创建核对项失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}

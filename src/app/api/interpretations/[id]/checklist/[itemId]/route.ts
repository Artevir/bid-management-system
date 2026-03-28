/**
 * 核对清单项API
 * PUT: 更新核对清单项
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { updateChecklistItem } from '@/lib/interpretation/service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { itemId } = await params;
    const checklistItemId = parseInt(itemId);

    if (isNaN(checklistItemId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    const { checkStatus, actualValue, proofDocuments, improvementSuggestion, remarks } = body;

    await updateChecklistItem(
      checklistItemId,
      {
        checkStatus,
        actualValue,
        proofDocuments: proofDocuments ? JSON.stringify(proofDocuments) : undefined,
        improvementSuggestion,
        remarks,
      },
      user.userId
    );

    return NextResponse.json({
      success: true,
      message: '更新成功',
    });
  } catch (error) {
    console.error('更新核对项失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}

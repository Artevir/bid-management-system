import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { smartResponseItems, smartResponseMatrix } from '@/db/smart-review-schema';
import { getCurrentUser } from '@/lib/auth/jwt';

const ALLOWED_STATUS = new Set(['pending', 'confirmed', 'rejected']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id, itemId } = await params;
    const documentId = Number(id);
    const requirementId = Number(itemId);
    if (!Number.isInteger(documentId) || documentId <= 0 || !Number.isInteger(requirementId)) {
      return NextResponse.json({ error: '无效的参数' }, { status: 400 });
    }

    const payload = (await request.json().catch(() => ({}))) as {
      status?: string;
      note?: string;
      responseContent?: string;
    };
    const status = String(payload.status || '').trim();
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json(
        { error: '无效的状态，支持 pending/confirmed/rejected' },
        { status: 400 }
      );
    }

    const [item] = await db
      .select()
      .from(smartResponseItems)
      .where(
        and(eq(smartResponseItems.id, requirementId), eq(smartResponseItems.documentId, documentId))
      )
      .limit(1);
    if (!item) {
      return NextResponse.json({ error: '要求资产不存在' }, { status: 404 });
    }

    const mergedContent = payload.responseContent || item.responseContent || '';
    const mergedSource = JSON.stringify({
      previousResponseSource: item.responseSource,
      note: payload.note || '',
      updatedBy: currentUser.username,
      updatedAt: new Date().toISOString(),
    });

    await db
      .update(smartResponseItems)
      .set({
        status,
        responseContent: mergedContent,
        responseSource: mergedSource,
        updatedAt: new Date(),
      })
      .where(eq(smartResponseItems.id, requirementId));

    const [matrix] = await db
      .select()
      .from(smartResponseMatrix)
      .where(eq(smartResponseMatrix.id, item.matrixId))
      .limit(1);
    if (matrix) {
      const items = await db
        .select({
          id: smartResponseItems.id,
          status: smartResponseItems.status,
        })
        .from(smartResponseItems)
        .where(eq(smartResponseItems.matrixId, matrix.id));
      const total = items.length;
      const confirmed = items.filter((x) => x.status === 'confirmed').length;
      const matchRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
      await db
        .update(smartResponseMatrix)
        .set({
          totalItems: total,
          respondedItems: confirmed,
          matchRate,
          updatedAt: new Date(),
        })
        .where(eq(smartResponseMatrix.id, matrix.id));
    }

    return NextResponse.json({
      success: true,
      message: '要求资产状态更新成功',
    });
  } catch (error) {
    console.error('Update smart-review requirement status error:', error);
    return NextResponse.json({ error: '更新要求资产失败' }, { status: 500 });
  }
}

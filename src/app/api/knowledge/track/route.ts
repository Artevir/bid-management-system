/**
 * 知识使用追踪API
 * POST: 记录知识使用（浏览、引用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { knowledgeItems } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

async function trackKnowledgeUse(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { itemId, action } = body;

    if (!itemId) {
      return NextResponse.json({ error: '缺少知识条目ID' }, { status: 400 });
    }

    const updateField = action === 'view' ? 'viewCount' : 'useCount';

    await db
      .update(knowledgeItems)
      .set({
        [updateField]: sql`${knowledgeItems[updateField]} + 1`,
      })
      .where(eq(knowledgeItems.id, itemId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track knowledge use error:', error);
    return NextResponse.json({ error: '记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => trackKnowledgeUse(req, userId));
}
import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { objectChangeLogs } from '@/db/schema';

// 040: GET /api/tender-center/change-logs
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    const { searchParams } = new URL(req.url);
    const pageNo = Math.max(1, Number(searchParams.get('pageNo') || '1'));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize') || '20')));
    const offset = (pageNo - 1) * pageSize;
    const targetObjectType = searchParams.get('targetObjectType')?.trim();
    const targetObjectIdRaw = searchParams.get('targetObjectId')?.trim();
    const targetObjectId = targetObjectIdRaw ? Number(targetObjectIdRaw) : null;

    const conditions = [eq(objectChangeLogs.operatorId, userId)];
    if (targetObjectType) {
      conditions.push(eq(objectChangeLogs.targetObjectType, targetObjectType));
    }
    if (targetObjectId && Number.isFinite(targetObjectId) && targetObjectId > 0) {
      conditions.push(eq(objectChangeLogs.targetObjectId, targetObjectId));
    }

    const rows = await db
      .select()
      .from(objectChangeLogs)
      .where(and(...conditions))
      .orderBy(desc(objectChangeLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = rows.map((row) => ({
      logId: row.id,
      targetObjectType: row.targetObjectType,
      targetObjectId: row.targetObjectId,
      changeType: row.changeType,
      before: row.beforeJson,
      after: row.afterJson,
      operatorId: row.operatorId,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        pageNo,
        pageSize,
        total: items.length,
      },
    });
  });
}

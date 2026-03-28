/**
 * 单个政采单位API
 * 支持查询、更新单个政采单位
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { biddingPlatforms, biddingRecords } from '@/db/bidding-platform-schema';
import { eq, desc } from 'drizzle-orm';

// ============================================
// GET - 查询单个政采单位详情
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 查询单位信息
    const [platform] = await db
      .select()
      .from(biddingPlatforms)
      .where(eq(biddingPlatforms.id, parseInt(id)));
    
    if (!platform) {
      return NextResponse.json(
        { success: false, error: '政采单位不存在' },
        { status: 404 }
      );
    }
    
    // 查询该单位的对接记录（最近10条）
    const records = await db
      .select()
      .from(biddingRecords)
      .where(eq(biddingRecords.platformId, parseInt(id)))
      .orderBy(desc(biddingRecords.createdAt))
      .limit(10);
    
    return NextResponse.json({
      success: true,
      platform,
      recentRecords: records,
    });
  } catch (error) {
    console.error('Failed to fetch platform:', error);
    return NextResponse.json(
      { success: false, error: '获取政采单位详情失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - 更新政采单位
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // 检查是否存在
    const existing = await db
      .select()
      .from(biddingPlatforms)
      .where(eq(biddingPlatforms.id, parseInt(id)))
      .limit(1);
    
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '政采单位不存在' },
        { status: 404 }
      );
    }
    
    // 更新数据
    const [updated] = await db
      .update(biddingPlatforms)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(biddingPlatforms.id, parseInt(id)))
      .returning();
    
    return NextResponse.json({
      success: true,
      platform: updated,
      message: '更新成功',
    });
  } catch (error) {
    console.error('Failed to update platform:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}

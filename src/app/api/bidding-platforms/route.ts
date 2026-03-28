/**
 * 政采单位管理API
 * 支持查询、新增、更新、删除政采单位
 * 集成抓取源实时联动
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  biddingPlatforms,
  biddingRecords,
  platformTypeEnum,
  platformStatusEnum,
} from '@/db/bidding-platform-schema';
import { eq, desc, asc, and, or, like, sql, inArray } from 'drizzle-orm';
import {
  syncCreateCrawlSource,
  syncUpdateCrawlSource,
  syncDeleteCrawlSource,
  syncAllPlatforms,
  getSyncStats,
} from '@/lib/bidding-platform/sync-service';

// ============================================
// GET - 查询政采单位列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 特殊操作：同步统计
    if (searchParams.get('action') === 'sync-stats') {
      const stats = await getSyncStats();
      return NextResponse.json({ success: true, stats });
    }
    
    // 查询参数
    const type = searchParams.get('type') as typeof platformTypeEnum.enumValues[number] | null;
    const status = searchParams.get('status') as typeof platformStatusEnum.enumValues[number] | null;
    const keyword = searchParams.get('keyword');
    const withCoordinates = searchParams.get('withCoordinates') === 'true';
    const withCrawlSource = searchParams.get('withCrawlSource') === 'true';
    
    // 构建查询条件
    const conditions = [];
    if (type) {
      conditions.push(eq(biddingPlatforms.type, type));
    }
    if (status) {
      conditions.push(eq(biddingPlatforms.status, status));
    }
    if (keyword) {
      conditions.push(
        or(
          like(biddingPlatforms.name, `%${keyword}%`),
          like(biddingPlatforms.shortName, `%${keyword}%`),
          like(biddingPlatforms.address, `%${keyword}%`)
        )
      );
    }
    
    // 如果只查询有坐标的单位
    if (withCoordinates) {
      conditions.push(sql`${biddingPlatforms.latitude} IS NOT NULL`);
      conditions.push(sql`${biddingPlatforms.longitude} IS NOT NULL`);
    }
    
    // 如果只查询已关联抓取源的单位
    if (withCrawlSource) {
      conditions.push(sql`${biddingPlatforms.crawlSourceId} IS NOT NULL`);
    }
    
    // 执行查询
    const platforms = await db
      .select()
      .from(biddingPlatforms)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(biddingPlatforms.sortOrder), asc(biddingPlatforms.id));
    
    // 按类型分组统计
    const typeStats = await db
      .select({
        type: biddingPlatforms.type,
        count: sql<number>`count(*)::int`,
      })
      .from(biddingPlatforms)
      .groupBy(biddingPlatforms.type);
    
    return NextResponse.json({
      success: true,
      platforms,
      typeStats: typeStats.reduce((acc, item) => {
        acc[item.type] = item.count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Failed to fetch bidding platforms:', error);
    return NextResponse.json(
      { success: false, error: '获取政采单位列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 新增政采单位
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证必填字段
    if (!body.name || !body.type || !body.address) {
      return NextResponse.json(
        { success: false, error: '单位名称、类型和地址为必填项' },
        { status: 400 }
      );
    }
    
    // 插入数据
    const [platform] = await db
      .insert(biddingPlatforms)
      .values({
        name: body.name,
        shortName: body.shortName || null,
        type: body.type,
        status: body.status || 'active',
        address: body.address,
        phone: body.phone || null,
        website: body.website || null,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        coordinatePrecision: body.coordinatePrecision || null,
        apiEndpoint: body.apiEndpoint || null,
        supportOnlineBid: body.supportOnlineBid || false,
        supportCaLogin: body.supportCaLogin || false,
        supportLiveStream: body.supportLiveStream || false,
        features: body.features || null,
        remarks: body.remarks || null,
        verificationSource: body.verificationSource || null,
        sortOrder: body.sortOrder || 0,
        syncToCrawlSource: body.syncToCrawlSource !== false, // 默认开启同步
      })
      .returning();
    
    // 🔄 实时联动：创建抓取源
    let crawlSourceInfo = null;
    if (platform.syncToCrawlSource && platform.website) {
      const syncResult = await syncCreateCrawlSource(platform);
      if (syncResult.success && syncResult.crawlSourceId) {
        // 重新获取更新后的平台数据
        const [updated] = await db
          .select()
          .from(biddingPlatforms)
          .where(eq(biddingPlatforms.id, platform.id));
        crawlSourceInfo = {
          id: syncResult.crawlSourceId,
          synced: true,
        };
        return NextResponse.json({
          success: true,
          platform: updated,
          crawlSource: crawlSourceInfo,
          message: '政采单位添加成功，已同步到抓取源',
        });
      } else if (!syncResult.success) {
        console.warn('同步到抓取源失败:', syncResult.error);
      }
    }
    
    return NextResponse.json({
      success: true,
      platform,
      crawlSource: crawlSourceInfo,
      message: '政采单位添加成功',
    });
  } catch (error) {
    console.error('Failed to create bidding platform:', error);
    return NextResponse.json(
      { success: false, error: '添加政采单位失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - 更新政采单位（单条或批量）
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 同步所有平台到抓取源
    if (body.action === 'sync-all') {
      const result = await syncAllPlatforms();
      return NextResponse.json({
        success: result.success,
        stats: result.stats,
        errors: result.errors,
        message: `同步完成：创建 ${result.stats.created}，更新 ${result.stats.updated}，跳过 ${result.stats.skipped}，失败 ${result.stats.errors}`,
      });
    }
    
    // 批量更新模式
    if (Array.isArray(body.platforms)) {
      const results = [];
      for (const platform of body.platforms) {
        // 检查是否已存在
        const existing = await db
          .select()
          .from(biddingPlatforms)
          .where(eq(biddingPlatforms.name, platform.name))
          .limit(1);
        
        if (existing.length > 0) {
          // 更新
          const [updated] = await db
            .update(biddingPlatforms)
            .set({
              ...platform,
              updatedAt: new Date(),
            })
            .where(eq(biddingPlatforms.id, existing[0].id))
            .returning();
          
          // 🔄 实时联动：更新抓取源
          if (updated.syncToCrawlSource) {
            await syncUpdateCrawlSource(updated, platform);
          }
          
          results.push(updated);
        } else {
          // 新增
          const [inserted] = await db
            .insert(biddingPlatforms)
            .values(platform)
            .returning();
          
          // 🔄 实时联动：创建抓取源
          if (inserted.syncToCrawlSource && inserted.website) {
            await syncCreateCrawlSource(inserted);
          }
          
          results.push(inserted);
        }
      }
      
      return NextResponse.json({
        success: true,
        count: results.length,
        platforms: results,
        message: `成功处理 ${results.length} 个政采单位`,
      });
    }
    
    // 单条更新模式
    if (body.id) {
      const [existing] = await db
        .select()
        .from(biddingPlatforms)
        .where(eq(biddingPlatforms.id, body.id))
        .limit(1);
      
      if (!existing) {
        return NextResponse.json(
          { success: false, error: '单位不存在' },
          { status: 404 }
        );
      }
      
      // 准备更新数据（排除不可修改的字段）
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      const allowedFields = [
        'name', 'shortName', 'type', 'status', 'address', 'phone', 'website',
        'latitude', 'longitude', 'coordinatePrecision', 'apiEndpoint',
        'supportOnlineBid', 'supportCaLogin', 'supportLiveStream',
        'features', 'remarks', 'verificationSource', 'sortOrder',
        'syncToCrawlSource',
      ];
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
      
      // 执行更新
      const [updated] = await db
        .update(biddingPlatforms)
        .set(updateData)
        .where(eq(biddingPlatforms.id, body.id))
        .returning();
      
      // 🔄 实时联动：更新抓取源
      let syncMessage = '';
      if (updated.syncToCrawlSource) {
        const syncResult = await syncUpdateCrawlSource(updated, updateData);
        if (syncResult.success) {
          syncMessage = '，已同步到抓取源';
        } else {
          console.warn('同步更新抓取源失败:', syncResult.error);
          syncMessage = '，但同步到抓取源失败';
        }
      }
      
      return NextResponse.json({
        success: true,
        platform: updated,
        message: `更新成功${syncMessage}`,
      });
    }
    
    return NextResponse.json(
      { success: false, error: '无效的请求参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to update platform:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除政采单位
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: '请提供单位ID' },
        { status: 400 }
      );
    }
    
    // 获取单位信息
    const [platform] = await db
      .select()
      .from(biddingPlatforms)
      .where(eq(biddingPlatforms.id, parseInt(id)))
      .limit(1);
    
    if (!platform) {
      return NextResponse.json(
        { success: false, error: '单位不存在' },
        { status: 404 }
      );
    }
    
    // 检查是否有关联记录
    const records = await db
      .select()
      .from(biddingRecords)
      .where(eq(biddingRecords.platformId, parseInt(id)))
      .limit(1);
    
    if (records.length > 0 && permanent) {
      return NextResponse.json(
        { success: false, error: '该单位存在对接记录，无法永久删除' },
        { status: 400 }
      );
    }
    
    // 🔄 实时联动：删除/禁用抓取源
    await syncDeleteCrawlSource(platform, permanent);
    
    // 如果不是永久删除，改为禁用
    if (!permanent) {
      await db
        .update(biddingPlatforms)
        .set({ status: 'inactive', updatedAt: new Date() })
        .where(eq(biddingPlatforms.id, parseInt(id)));
      
      return NextResponse.json({
        success: true,
        message: '已禁用政采单位及其抓取源',
      });
    }
    
    // 永久删除
    await db.delete(biddingPlatforms).where(eq(biddingPlatforms.id, parseInt(id)));
    
    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('Failed to delete platform:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}

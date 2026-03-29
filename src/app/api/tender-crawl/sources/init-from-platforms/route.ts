/**
 * 从政采单位导入默认抓取源
 * 将 bidding_platforms 表中的单位数据转换为 crawl_sources 信息源
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { biddingPlatforms } from '@/db/bidding-platform-schema';
import { crawlSources, users } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

// 类型映射：政采单位类型 -> 抓取源类型
const TYPE_MAPPING: Record<string, 'government' | 'enterprise'> = {
  provincial_official: 'government',    // 区级官方平台 -> 政府采购网
  provincial_cloud: 'government',       // 政府采购云 -> 政府采购网
  state_owned: 'enterprise',            // 国企采购平台 -> 企业招标平台
  city_center: 'government',            // 地市交易中心 -> 政府采购网
  agent_company: 'enterprise',          // 招标代理公司 -> 企业招标平台
};

// 类型中文名称映射
const TYPE_LABELS: Record<string, string> = {
  provincial_official: '区级官方平台',
  provincial_cloud: '政府采购云平台',
  state_owned: '国企采购平台',
  city_center: '地市交易中心',
  agent_company: '招标代理公司',
};

// 生成抓取源代码
function generateCode(name: string, index: number): string {
  // 简化名称生成代码
  const simplified = name
    .replace(/广西壮族自治区/g, 'gx')
    .replace(/广西/g, 'gx')
    .replace(/公共资源交易中心/g, 'ggzy')
    .replace(/交易中心/g, 'jy')
    .replace(/招标有限公司/g, 'zb')
    .replace(/招标咨询/g, 'zb')
    .replace(/工程咨询/g, 'gc')
    .replace(/工程管理/g, 'gc')
    .replace(/集团有限公司/g, 'group')
    .replace(/有限公司/g, '')
    .replace(/股份有限公司/g, '')
    .replace(/有限责任公司/g, '')
    .replace(/市/g, '')
    .replace(/自治区/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  
  return `${simplified.substring(0, 30)}_${index}`;
}

// POST - 从政采单位导入抓取源
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const force = body?.force === true; // 是否强制覆盖已存在的
    const platformTypes = body?.platformTypes as string[] | undefined; // 指定要导入的类型
    
    // 获取系统管理员用户作为创建者
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'))
      .limit(1);
    
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: '找不到管理员用户，请先创建用户' },
        { status: 400 }
      );
    }
    
    // 查询政采单位
    const conditions = [];
    if (platformTypes && platformTypes.length > 0) {
      conditions.push(inArray(biddingPlatforms.type, platformTypes as any));
    }
    
    const platforms = await db
      .select()
      .from(biddingPlatforms)
      .where(conditions.length > 0 ? conditions.reduce((acc, cond) => acc ? eq(biddingPlatforms.id, 0) : cond, undefined as any) : undefined);
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const results: Array<{
      platformName: string;
      sourceCode: string;
      action: 'created' | 'updated' | 'skipped';
    }> = [];
    
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      
      // 跳过没有网站的单位
      if (!platform.website) {
        skipped++;
        results.push({
          platformName: platform.name,
          sourceCode: '',
          action: 'skipped',
        });
        continue;
      }
      
      const sourceCode = generateCode(platform.name, i + 1);
      const sourceType = TYPE_MAPPING[platform.type] || 'custom';
      
      // 构建抓取源配置
      const crawlConfig = JSON.stringify({
        platformType: platform.type,
        platformTypeName: TYPE_LABELS[platform.type],
        platformId: platform.id,
        shortName: platform.shortName,
        address: platform.address,
        phone: platform.phone,
        supportOnlineBid: platform.supportOnlineBid,
        supportCaLogin: platform.supportCaLogin,
        supportLiveStream: platform.supportLiveStream,
        features: platform.features,
        remarks: platform.remarks,
      });
      
      // 检查是否已存在
      const existing = await db
        .select()
        .from(crawlSources)
        .where(eq(crawlSources.code, sourceCode))
        .limit(1);
      
      if (existing.length > 0) {
        if (force) {
          // 更新
          await db
            .update(crawlSources)
            .set({
              name: platform.name,
              baseUrl: platform.website,
              crawlConfig,
              updatedAt: new Date(),
            })
            .where(eq(crawlSources.id, existing[0].id));
          updated++;
          results.push({
            platformName: platform.name,
            sourceCode,
            action: 'updated',
          });
        } else {
          skipped++;
          results.push({
            platformName: platform.name,
            sourceCode,
            action: 'skipped',
          });
        }
      } else {
        // 创建新抓取源
        await db.insert(crawlSources).values({
          name: platform.name,
          code: sourceCode,
          type: sourceType,
          baseUrl: platform.website,
          listUrl: platform.website,
          crawlConfig,
          scheduleType: 'manual',
          isActive: platform.status === 'active',
          createdBy: adminUser.id,
        });
        inserted++;
        results.push({
          platformName: platform.name,
          sourceCode,
          action: 'created',
        });
      }
    }
    
    // 按类型统计
    const typeStats: Record<string, number> = {};
    for (const platform of platforms) {
      const label = TYPE_LABELS[platform.type] || platform.type;
      typeStats[label] = (typeStats[label] || 0) + 1;
    }
    
    return NextResponse.json({
      success: true,
      message: `导入完成：新增 ${inserted} 个，更新 ${updated} 个，跳过 ${skipped} 个`,
      stats: {
        inserted,
        updated,
        skipped,
        total: platforms.length,
        byType: typeStats,
      },
      results,
    });
  } catch (error) {
    console.error('Failed to import sources from platforms:', error);
    return NextResponse.json(
      { success: false, error: '导入失败' },
      { status: 500 }
    );
  }
}

// GET - 获取可导入的政采单位统计
export async function GET(_request: NextRequest) {
  try {
    const platforms = await db.select().from(biddingPlatforms);
    
    // 按类型统计
    const typeStats: Record<string, { count: number; withWebsite: number }> = {};
    let totalWithWebsite = 0;
    
    for (const platform of platforms) {
      const label = TYPE_LABELS[platform.type] || platform.type;
      if (!typeStats[label]) {
        typeStats[label] = { count: 0, withWebsite: 0 };
      }
      typeStats[label].count++;
      if (platform.website) {
        typeStats[label].withWebsite++;
        totalWithWebsite++;
      }
    }
    
    return NextResponse.json({
      success: true,
      total: platforms.length,
      totalWithWebsite,
      byType: typeStats,
      typeMapping: TYPE_MAPPING,
      typeLabels: TYPE_LABELS,
    });
  } catch (error) {
    console.error('Failed to get platform stats:', error);
    return NextResponse.json(
      { success: false, error: '获取统计失败' },
      { status: 500 }
    );
  }
}

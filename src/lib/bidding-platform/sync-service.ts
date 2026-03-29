/**
 * 政采单位与抓取源联动服务
 * 实现新增/修改/删除时的实时同步
 */

import { db } from '@/db';
import { biddingPlatforms, type BiddingPlatform, type NewBiddingPlatform } from '@/db/bidding-platform-schema';
import { crawlSources, users } from '@/db/schema';
import { eq, and as _and, isNotNull as _isNotNull } from 'drizzle-orm';

// ============================================
// 类型映射
// ============================================

// 政采单位类型 -> 抓取源类型
const TYPE_TO_CRAWL_TYPE: Record<string, 'government' | 'enterprise'> = {
  provincial_official: 'government',
  provincial_cloud: 'government',
  state_owned: 'enterprise',
  city_center: 'government',
  agent_company: 'enterprise',
};

// 类型中文名称
const TYPE_LABELS: Record<string, string> = {
  provincial_official: '区级官方平台',
  provincial_cloud: '政府采购云平台',
  state_owned: '国企采购平台',
  city_center: '地市交易中心',
  agent_company: '招标代理公司',
};

// ============================================
// 辅助函数
// ============================================

/**
 * 生成抓取源代码
 */
function generateCrawlSourceCode(name: string, id: number): string {
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
  
  return `${simplified.substring(0, 25)}_${id}`;
}

/**
 * 生成抓取源配置
 */
function generateCrawlConfig(platform: BiddingPlatform | NewBiddingPlatform): string {
  return JSON.stringify({
    platformId: platform.id,
    platformType: platform.type,
    platformTypeName: TYPE_LABELS[platform.type as string] || platform.type,
    shortName: platform.shortName,
    address: platform.address,
    phone: platform.phone,
    supportOnlineBid: platform.supportOnlineBid,
    supportCaLogin: platform.supportCaLogin,
    supportLiveStream: platform.supportLiveStream,
    features: platform.features,
    remarks: platform.remarks,
    syncEnabled: true,
  });
}

/**
 * 获取系统管理员用户ID
 */
async function getSystemUserId(): Promise<number> {
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  
  return adminUser?.id || 1; // 默认返回1
}

// ============================================
// 联动服务函数
// ============================================

/**
 * 创建抓取源（新增单位时调用）
 */
export async function syncCreateCrawlSource(
  platform: BiddingPlatform
): Promise<{ success: boolean; crawlSourceId?: number; error?: string }> {
  try {
    // 检查是否需要同步
    if (!platform.syncToCrawlSource) {
      return { success: true, crawlSourceId: undefined };
    }
    
    // 检查是否已有抓取源
    if (platform.crawlSourceId) {
      return { success: true, crawlSourceId: platform.crawlSourceId };
    }
    
    // 检查是否有网站
    if (!platform.website) {
      return { success: true, crawlSourceId: undefined };
    }
    
    const systemUserId = await getSystemUserId();
    const sourceCode = generateCrawlSourceCode(platform.name, platform.id);
    const sourceType = TYPE_TO_CRAWL_TYPE[platform.type] || 'custom';
    const crawlConfig = generateCrawlConfig(platform);
    
    // 创建抓取源
    const [crawlSource] = await db
      .insert(crawlSources)
      .values({
        name: platform.name,
        code: sourceCode,
        type: sourceType,
        baseUrl: platform.website,
        listUrl: platform.website,
        crawlConfig,
        scheduleType: 'manual',
        isActive: platform.status === 'active',
        createdBy: systemUserId,
      })
      .returning();
    
    // 更新政采单位，关联抓取源ID
    await db
      .update(biddingPlatforms)
      .set({
        crawlSourceId: crawlSource.id,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(biddingPlatforms.id, platform.id));
    
    return { success: true, crawlSourceId: crawlSource.id };
  } catch (error) {
    console.error('同步创建抓取源失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 更新抓取源（修改单位时调用）
 */
export async function syncUpdateCrawlSource(
  platform: BiddingPlatform,
  changes: Partial<NewBiddingPlatform>
): Promise<{ success: boolean; error?: string }> {
  try {
    // 如果关闭了同步开关，禁用抓取源
    if (changes.syncToCrawlSource === false && platform.crawlSourceId) {
      await db
        .update(crawlSources)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(crawlSources.id, platform.crawlSourceId));
      
      return { success: true };
    }
    
    // 如果开启同步，但没有抓取源，则创建
    if (changes.syncToCrawlSource === true && !platform.crawlSourceId && platform.website) {
      return syncCreateCrawlSource(platform);
    }
    
    // 如果有抓取源，更新配置
    if (platform.crawlSourceId) {
      const updateData: Record<string, unknown> = {
        crawlConfig: generateCrawlConfig({ ...platform, ...changes }),
        updatedAt: new Date(),
      };
      
      // 同步名称
      if (changes.name) {
        updateData.name = changes.name;
        updateData.code = generateCrawlSourceCode(changes.name, platform.id);
      }
      
      // 同步网站
      if (changes.website !== undefined) {
        updateData.baseUrl = changes.website;
        updateData.listUrl = changes.website;
        
        // 如果清空了网站，禁用抓取源
        if (!changes.website) {
          updateData.isActive = false;
        }
      }
      
      // 同步状态
      if (changes.status !== undefined) {
        updateData.isActive = changes.status === 'active';
      }
      
      await db
        .update(crawlSources)
        .set(updateData)
        .where(eq(crawlSources.id, platform.crawlSourceId));
      
      // 更新同步时间
      await db
        .update(biddingPlatforms)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(biddingPlatforms.id, platform.id));
    }
    
    return { success: true };
  } catch (error) {
    console.error('同步更新抓取源失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 删除/禁用抓取源（删除单位时调用）
 */
export async function syncDeleteCrawlSource(
  platform: BiddingPlatform,
  permanent: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!platform.crawlSourceId) {
      return { success: true };
    }
    
    if (permanent) {
      // 永久删除抓取源
      await db
        .delete(crawlSources)
        .where(eq(crawlSources.id, platform.crawlSourceId));
    } else {
      // 禁用抓取源（保留记录）
      await db
        .update(crawlSources)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(crawlSources.id, platform.crawlSourceId));
    }
    
    return { success: true };
  } catch (error) {
    console.error('同步删除抓取源失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 批量同步所有政采单位
 */
export async function syncAllPlatforms(): Promise<{
  success: boolean;
  stats: { created: number; updated: number; skipped: number; errors: number };
  errors: string[];
}> {
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: string[] = [];
  
  try {
    const platforms = await db
      .select()
      .from(biddingPlatforms)
      .where(eq(biddingPlatforms.syncToCrawlSource, true));
    
    for (const platform of platforms) {
      // 已有抓取源的更新
      if (platform.crawlSourceId) {
        const result = await syncUpdateCrawlSource(platform, {});
        if (result.success) {
          stats.updated++;
        } else {
          stats.errors++;
          errors.push(`${platform.name}: ${result.error}`);
        }
      }
      // 没有抓取源但有网站的创建
      else if (platform.website) {
        const result = await syncCreateCrawlSource(platform);
        if (result.success) {
          stats.created++;
        } else {
          stats.errors++;
          errors.push(`${platform.name}: ${result.error}`);
        }
      }
      // 没有网站的跳过
      else {
        stats.skipped++;
      }
    }
    
    return { success: true, stats, errors };
  } catch (error) {
    console.error('批量同步失败:', error);
    return { success: false, stats, errors: [String(error)] };
  }
}

/**
 * 获取同步状态
 */
export async function getSyncStats(): Promise<{
  totalPlatforms: number;
  withCrawlSource: number;
  pendingSync: number;
  syncDisabled: number;
  withoutWebsite: number;
}> {
  const platforms = await db.select().from(biddingPlatforms);
  
  return {
    totalPlatforms: platforms.length,
    withCrawlSource: platforms.filter(p => p.crawlSourceId !== null).length,
    pendingSync: platforms.filter(p => p.syncToCrawlSource && !p.crawlSourceId && p.website).length,
    syncDisabled: platforms.filter(p => !p.syncToCrawlSource).length,
    withoutWebsite: platforms.filter(p => !p.website).length,
  };
}

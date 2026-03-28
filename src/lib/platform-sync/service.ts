/**
 * 政采信息联动服务
 * 实现政采单位信息与业务模块的数据联动
 * 
 * 核心功能：
 * 1. 名称智能匹配政采单位
 * 2. 获取政采单位完整信息
 * 3. 提供各业务场景的信息获取（买标书、开标、投标等）
 */

import { db } from '@/db';
import {
  biddingPlatforms,
  biddingRecords,
  type BiddingPlatform,
  type PlatformType,
} from '@/db/bidding-platform-schema';
import { projects, bidDocumentInterpretations } from '@/db/schema';
import { eq, and, or, like, sql, desc, inArray } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

/** 政采单位完整信息 */
export interface PlatformFullInfo extends BiddingPlatform {
  /** 投标项目数量 */
  bidProjectCount: number;
  /** 中标项目数量 */
  winProjectCount: number;
  /** 最近投标记录 */
  recentRecords: PlatformRecord[];
}

/** 投标记录摘要 */
export interface PlatformRecord {
  id: number;
  projectName: string;
  bidDeadline: Date | null;
  resultStatus: string | null;
  createdAt: Date;
}

/** 买标书场景信息 */
export interface PurchaseSceneInfo {
  /** 单位名称 */
  name: string;
  /** 单位类型 */
  type: PlatformType;
  /** 单位类型名称 */
  typeName: string;
  /** 详细地址 */
  address: string;
  /** 联系电话 */
  phone: string | null;
  /** 官网 */
  website: string | null;
  /** 经度 */
  longitude: string | null;
  /** 纬度 */
  latitude: string | null;
  /** 坐标精度 */
  coordinatePrecision: string | null;
  /** 是否支持在线报名 */
  supportOnlineRegistration: boolean;
  /** 是否需要CA证书 */
  requireCaCert: boolean;
  /** 备注 */
  remarks: string | null;
}

/** 开标场景信息 */
export interface OpenBidSceneInfo {
  /** 单位名称 */
  name: string;
  /** 开标地点（如果政采单位有单独的开标地点） */
  openBidLocation: string | null;
  /** 地址 */
  address: string;
  /** 经度 */
  longitude: string | null;
  /** 纬度 */
  latitude: string | null;
  /** 坐标精度 */
  coordinatePrecision: string | null;
  /** 是否支持开标直播 */
  supportLiveStream: boolean;
  /** 联系电话 */
  phone: string | null;
}

/** 投标场景信息 */
export interface SubmitBidSceneInfo {
  /** 单位名称 */
  name: string;
  /** 单位类型 */
  type: PlatformType;
  /** 投标地址 */
  submitAddress: string;
  /** 经度 */
  longitude: string | null;
  /** 纬度 */
  latitude: string | null;
  /** 是否支持在线投标 */
  supportOnlineBid: boolean;
  /** 是否支持CA登录 */
  supportCaLogin: boolean;
  /** 官网 */
  website: string | null;
  /** API对接地址 */
  apiEndpoint: string | null;
  /** 联系电话 */
  phone: string | null;
  /** 特色功能 */
  features: string[] | null;
}

/** 匹配结果 */
export interface MatchResult {
  /** 是否匹配成功 */
  matched: boolean;
  /** 匹配的政采单位（可能有多个候选项） */
  candidates: BiddingPlatform[];
  /** 最佳匹配 */
  bestMatch: BiddingPlatform | null;
  /** 匹配分数（0-100） */
  matchScore: number;
}

// ============================================
// 常量定义
// ============================================

/** 单位类型中文名称 */
export const PLATFORM_TYPE_LABELS: Record<PlatformType, string> = {
  provincial_official: '省级官方平台',
  provincial_cloud: '政府采购云平台',
  state_owned: '国企采购平台',
  city_center: '地市交易中心',
  agent_company: '招标代理公司',
};

/** 招标代理类型 */
export const AGENT_PLATFORM_TYPES: PlatformType[] = ['agent_company'];

/** 政府采购单位类型 */
export const GOVERNMENT_PLATFORM_TYPES: PlatformType[] = [
  'provincial_official',
  'provincial_cloud',
  'city_center',
];

// ============================================
// 智能匹配服务
// ============================================

/**
 * 通过名称智能匹配政采单位
 * @param name 单位名称
 * @param type 单位类型限制（可选）
 * @returns 匹配结果
 */
export async function matchPlatformByName(
  name: string,
  type?: 'tender' | 'agent' // tender=招标单位, agent=招标代理
): Promise<MatchResult> {
  if (!name || name.trim().length === 0) {
    return { matched: false, candidates: [], bestMatch: null, matchScore: 0 };
  }

  const trimmedName = name.trim();
  
  // 构建查询条件
  const conditions = [];
  
  // 类型过滤
  if (type === 'tender') {
    conditions.push(inArray(biddingPlatforms.type, GOVERNMENT_PLATFORM_TYPES));
  } else if (type === 'agent') {
    conditions.push(inArray(biddingPlatforms.type, AGENT_PLATFORM_TYPES));
  }
  
  // 精确匹配（名称或简称）
  const exactMatches = await db
    .select()
    .from(biddingPlatforms)
    .where(
      and(
        conditions.length > 0 ? and(...conditions) : undefined,
        eq(biddingPlatforms.status, 'active'),
        or(
          eq(biddingPlatforms.name, trimmedName),
          eq(biddingPlatforms.shortName, trimmedName)
        )
      )
    )
    .limit(5);
  
  if (exactMatches.length > 0) {
    return {
      matched: true,
      candidates: exactMatches,
      bestMatch: exactMatches[0],
      matchScore: 100,
    };
  }
  
  // 模糊匹配（包含关系）
  const fuzzyMatches = await db
    .select()
    .from(biddingPlatforms)
    .where(
      and(
        conditions.length > 0 ? and(...conditions) : undefined,
        eq(biddingPlatforms.status, 'active'),
        or(
          like(biddingPlatforms.name, `%${trimmedName}%`),
          like(biddingPlatforms.shortName, `%${trimmedName}%`)
        )
      )
    )
    .orderBy(asc(biddingPlatforms.sortOrder), asc(biddingPlatforms.id))
    .limit(5);
  
  if (fuzzyMatches.length > 0) {
    // 计算匹配分数
    const bestMatch = fuzzyMatches[0];
    const matchScore = calculateMatchScore(trimmedName, bestMatch.name, bestMatch.shortName);
    
    return {
      matched: true,
      candidates: fuzzyMatches,
      bestMatch,
      matchScore,
    };
  }
  
  // 反向模糊匹配（单位名称包含查询词）
  const reverseMatches = await db
    .select()
    .from(biddingPlatforms)
    .where(
      and(
        conditions.length > 0 ? and(...conditions) : undefined,
        eq(biddingPlatforms.status, 'active'),
        sql`${trimmedName} LIKE CONCAT('%', ${biddingPlatforms.name}, '%') 
            OR ${trimmedName} LIKE CONCAT('%', ${biddingPlatforms.shortName}, '%')`
      )
    )
    .limit(5);
  
  if (reverseMatches.length > 0) {
    return {
      matched: true,
      candidates: reverseMatches,
      bestMatch: reverseMatches[0],
      matchScore: 60,
    };
  }
  
  return { matched: false, candidates: [], bestMatch: null, matchScore: 0 };
}

/**
 * 计算匹配分数
 */
function calculateMatchScore(
  queryName: string,
  platformName: string,
  shortName: string | null
): number {
  const query = queryName.toLowerCase();
  const fullName = platformName.toLowerCase();
  const short = shortName?.toLowerCase() || '';
  
  // 简称完全匹配
  if (short && short === query) {
    return 95;
  }
  
  // 名称包含查询词
  if (fullName.includes(query)) {
    // 计算相似度比例
    const ratio = query.length / fullName.length;
    return Math.round(70 + ratio * 25);
  }
  
  // 查询词包含名称
  if (query.includes(fullName) || (short && query.includes(short))) {
    return 80;
  }
  
  return 50;
}

/**
 * 导入缺失的 asc 函数
 */
import { asc } from 'drizzle-orm';

// ============================================
// 信息获取服务
// ============================================

/**
 * 获取政采单位完整信息
 */
export async function getPlatformFullInfo(platformId: number): Promise<PlatformFullInfo | null> {
  const [platform] = await db
    .select()
    .from(biddingPlatforms)
    .where(eq(biddingPlatforms.id, platformId))
    .limit(1);
  
  if (!platform) {
    return null;
  }
  
  // 获取投标记录
  const records = await db
    .select()
    .from(biddingRecords)
    .where(eq(biddingRecords.platformId, platformId))
    .orderBy(desc(biddingRecords.createdAt))
    .limit(10);
  
  return {
    ...platform,
    bidProjectCount: platform.bidCount || 0,
    winProjectCount: platform.winCount || 0,
    recentRecords: records.map(r => ({
      id: r.id,
      projectName: r.projectName || '',
      bidDeadline: r.bidDeadline,
      resultStatus: r.resultStatus,
      createdAt: r.createdAt,
    })),
  };
}

/**
 * 获取买标书场景信息
 */
export async function getPurchaseSceneInfo(platformId: number): Promise<PurchaseSceneInfo | null> {
  const [platform] = await db
    .select()
    .from(biddingPlatforms)
    .where(eq(biddingPlatforms.id, platformId))
    .limit(1);
  
  if (!platform) {
    return null;
  }
  
  return {
    name: platform.name,
    type: platform.type,
    typeName: PLATFORM_TYPE_LABELS[platform.type] || platform.type,
    address: platform.address,
    phone: platform.phone,
    website: platform.website,
    longitude: platform.longitude,
    latitude: platform.latitude,
    coordinatePrecision: platform.coordinatePrecision,
    supportOnlineRegistration: platform.supportCaLogin || false, // CA登录通常意味着支持在线报名
    requireCaCert: platform.supportCaLogin || false,
    remarks: platform.remarks,
  };
}

/**
 * 获取开标场景信息
 */
export async function getOpenBidSceneInfo(platformId: number): Promise<OpenBidSceneInfo | null> {
  const [platform] = await db
    .select()
    .from(biddingPlatforms)
    .where(eq(biddingPlatforms.id, platformId))
    .limit(1);
  
  if (!platform) {
    return null;
  }
  
  return {
    name: platform.name,
    openBidLocation: null, // 开标地点通常在招标文件中指定，这里不存储
    address: platform.address,
    longitude: platform.longitude,
    latitude: platform.latitude,
    coordinatePrecision: platform.coordinatePrecision,
    supportLiveStream: platform.supportLiveStream || false,
    phone: platform.phone,
  };
}

/**
 * 获取投标场景信息
 */
export async function getSubmitBidSceneInfo(platformId: number): Promise<SubmitBidSceneInfo | null> {
  const [platform] = await db
    .select()
    .from(biddingPlatforms)
    .where(eq(biddingPlatforms.id, platformId))
    .limit(1);
  
  if (!platform) {
    return null;
  }
  
  // 解析特色功能
  let features: string[] | null = null;
  if (platform.features) {
    try {
      features = JSON.parse(platform.features);
    } catch {
      features = null;
    }
  }
  
  return {
    name: platform.name,
    type: platform.type,
    submitAddress: platform.address, // 投标地址通常为单位地址
    longitude: platform.longitude,
    latitude: platform.latitude,
    supportOnlineBid: platform.supportOnlineBid || false,
    supportCaLogin: platform.supportCaLogin || false,
    website: platform.website,
    apiEndpoint: platform.apiEndpoint,
    phone: platform.phone,
    features,
  };
}

// ============================================
// 数据联动服务
// ============================================

/**
 * 为文件解读关联政采单位
 * 通过提取的招标单位和代理机构名称自动匹配
 */
export async function linkInterpretationToPlatforms(
  interpretationId: number
): Promise<{
  platformId: number | null;
  agentPlatformId: number | null;
  platformMatchScore: number;
  agentMatchScore: number;
}> {
  // 获取文件解读信息
  const [interpretation] = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.id, interpretationId))
    .limit(1);
  
  if (!interpretation) {
    return {
      platformId: null,
      agentPlatformId: null,
      platformMatchScore: 0,
      agentMatchScore: 0,
    };
  }
  
  let platformId: number | null = null;
  let agentPlatformId: number | null = null;
  let platformMatchScore = 0;
  let agentMatchScore = 0;
  
  // 匹配招标单位
  if (interpretation.tenderOrganization) {
    const matchResult = await matchPlatformByName(
      interpretation.tenderOrganization,
      'tender'
    );
    
    if (matchResult.matched && matchResult.bestMatch) {
      platformId = matchResult.bestMatch.id;
      platformMatchScore = matchResult.matchScore;
    }
  }
  
  // 匹配招标代理
  if (interpretation.tenderAgent) {
    const matchResult = await matchPlatformByName(
      interpretation.tenderAgent,
      'agent'
    );
    
    if (matchResult.matched && matchResult.bestMatch) {
      agentPlatformId = matchResult.bestMatch.id;
      agentMatchScore = matchResult.matchScore;
    }
  }
  
  // 更新文件解读记录
  if (platformId !== null || agentPlatformId !== null) {
    await db
      .update(bidDocumentInterpretations)
      .set({
        platformId,
        agentPlatformId,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, interpretationId));
  }
  
  return {
    platformId,
    agentPlatformId,
    platformMatchScore,
    agentMatchScore,
  };
}

/**
 * 为项目关联政采单位
 */
export async function linkProjectToPlatforms(
  projectId: number,
  interpretationId?: number
): Promise<{
  platformId: number | null;
  agentPlatformId: number | null;
}> {
  let platformId: number | null = null;
  let agentPlatformId: number | null = null;
  
  // 优先从文件解读获取关联
  if (interpretationId) {
    const [interpretation] = await db
      .select()
      .from(bidDocumentInterpretations)
      .where(eq(bidDocumentInterpretations.id, interpretationId))
      .limit(1);
    
    if (interpretation) {
      platformId = interpretation.platformId;
      agentPlatformId = interpretation.agentPlatformId;
    }
  }
  
  // 如果文件解读没有关联，尝试通过名称匹配
  if (!platformId || !agentPlatformId) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    
    if (project) {
      if (!platformId && project.tenderOrganization) {
        const matchResult = await matchPlatformByName(
          project.tenderOrganization,
          'tender'
        );
        if (matchResult.matched && matchResult.bestMatch) {
          platformId = matchResult.bestMatch.id;
        }
      }
      
      if (!agentPlatformId && project.tenderAgent) {
        const matchResult = await matchPlatformByName(
          project.tenderAgent,
          'agent'
        );
        if (matchResult.matched && matchResult.bestMatch) {
          agentPlatformId = matchResult.bestMatch.id;
        }
      }
    }
  }
  
  // 更新项目记录
  if (platformId !== null || agentPlatformId !== null) {
    await db
      .update(projects)
      .set({
        platformId,
        agentPlatformId,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
  }
  
  return { platformId, agentPlatformId };
}

/**
 * 通过文件解读ID获取政采单位信息
 */
export async function getPlatformInfoByInterpretation(
  interpretationId: number,
  scene: 'purchase' | 'openBid' | 'submitBid' | 'full'
): Promise<{
  platform: PurchaseSceneInfo | OpenBidSceneInfo | SubmitBidSceneInfo | PlatformFullInfo | null;
  agentPlatform: PurchaseSceneInfo | OpenBidSceneInfo | SubmitBidSceneInfo | PlatformFullInfo | null;
}> {
  const [interpretation] = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.id, interpretationId))
    .limit(1);
  
  if (!interpretation) {
    return { platform: null, agentPlatform: null };
  }
  
  let platform = null;
  let agentPlatform = null;
  
  // 获取招标单位信息
  if (interpretation.platformId) {
    switch (scene) {
      case 'purchase':
        platform = await getPurchaseSceneInfo(interpretation.platformId);
        break;
      case 'openBid':
        platform = await getOpenBidSceneInfo(interpretation.platformId);
        break;
      case 'submitBid':
        platform = await getSubmitBidSceneInfo(interpretation.platformId);
        break;
      case 'full':
        platform = await getPlatformFullInfo(interpretation.platformId);
        break;
    }
  }
  
  // 获取招标代理信息
  if (interpretation.agentPlatformId) {
    switch (scene) {
      case 'purchase':
        agentPlatform = await getPurchaseSceneInfo(interpretation.agentPlatformId);
        break;
      case 'openBid':
        agentPlatform = await getOpenBidSceneInfo(interpretation.agentPlatformId);
        break;
      case 'submitBid':
        agentPlatform = await getSubmitBidSceneInfo(interpretation.agentPlatformId);
        break;
      case 'full':
        agentPlatform = await getPlatformFullInfo(interpretation.agentPlatformId);
        break;
    }
  }
  
  return { platform, agentPlatform };
}

/**
 * 通过项目ID获取政采单位信息
 */
export async function getPlatformInfoByProject(
  projectId: number,
  scene: 'purchase' | 'openBid' | 'submitBid' | 'full'
): Promise<{
  platform: PurchaseSceneInfo | OpenBidSceneInfo | SubmitBidSceneInfo | PlatformFullInfo | null;
  agentPlatform: PurchaseSceneInfo | OpenBidSceneInfo | SubmitBidSceneInfo | PlatformFullInfo | null;
}> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  
  if (!project) {
    return { platform: null, agentPlatform: null };
  }
  
  let platform = null;
  let agentPlatform = null;
  
  // 获取招标单位信息
  if (project.platformId) {
    switch (scene) {
      case 'purchase':
        platform = await getPurchaseSceneInfo(project.platformId);
        break;
      case 'openBid':
        platform = await getOpenBidSceneInfo(project.platformId);
        break;
      case 'submitBid':
        platform = await getSubmitBidSceneInfo(project.platformId);
        break;
      case 'full':
        platform = await getPlatformFullInfo(project.platformId);
        break;
    }
  }
  
  // 获取招标代理信息
  if (project.agentPlatformId) {
    switch (scene) {
      case 'purchase':
        agentPlatform = await getPurchaseSceneInfo(project.agentPlatformId);
        break;
      case 'openBid':
        agentPlatform = await getOpenBidSceneInfo(project.agentPlatformId);
        break;
      case 'submitBid':
        agentPlatform = await getSubmitBidSceneInfo(project.agentPlatformId);
        break;
      case 'full':
        agentPlatform = await getPlatformFullInfo(project.agentPlatformId);
        break;
    }
  }
  
  return { platform, agentPlatform };
}

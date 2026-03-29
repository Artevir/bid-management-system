/**
 * 统一申请服务层
 * 用于查询所有类型的申请（授权申请、样机申请、价格申请、友司支持）
 */

import { db } from '@/db';
import {
  authorizationApplications,
  sampleApplications,
  priceApplications,
  partnerApplications,
  users as _users,
} from '@/db/schema';
import { eq, and, desc, asc as _asc, like, or, inArray as _inArray, count, sql as _sql } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export type ApplicationType = 'authorization' | 'sample' | 'price' | 'partner';

export interface UnifiedApplication {
  id: number;
  type: ApplicationType;
  applicationNo: string;
  projectName: string | null;
  handlerName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 状态映射
// ============================================

const AUTHORIZATION_STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  material_pending: '材料待接收',
  material_received: '材料已接收',
  completed: '授权完成',
  terminated: '申请终止',
};

const SAMPLE_STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  sample_pending: '样机待接收',
  sample_received: '样机已接收',
  sample_returned: '样机已归还',
  terminated: '申请终止',
};

const PRICE_STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '审核驳回',
  terminated: '申请终止',
};

const PARTNER_STATUS_LABELS: Record<string, string> = {
  draft: '待提交',
  pending_confirm: '待友司确认',
  confirmed: '友司已确认',
  material_pending: '材料待接收',
  material_received: '材料已接收',
  completed: '支持完成',
  terminated: '申请终止',
};

export function getStatusLabel(type: ApplicationType, status: string): string {
  switch (type) {
    case 'authorization':
      return AUTHORIZATION_STATUS_LABELS[status] || status;
    case 'sample':
      return SAMPLE_STATUS_LABELS[status] || status;
    case 'price':
      return PRICE_STATUS_LABELS[status] || status;
    case 'partner':
      return PARTNER_STATUS_LABELS[status] || status;
    default:
      return status;
  }
}

export function getTypeLabel(type: ApplicationType): string {
  switch (type) {
    case 'authorization':
      return '授权申请';
    case 'sample':
      return '样机申请';
    case 'price':
      return '价格申请';
    case 'partner':
      return '友司支持';
    default:
      return type;
  }
}

// ============================================
// 统一申请列表查询
// ============================================

export interface GetUnifiedApplicationsOptions {
  type?: ApplicationType;
  status?: string;
  keyword?: string;
  handlerId?: number;
  page?: number;
  pageSize?: number;
}

export async function getUnifiedApplications(options: GetUnifiedApplicationsOptions = {}) {
  const { page = 1, pageSize = 20, type, status, keyword, handlerId } = options;

  const results: UnifiedApplication[] = [];

  // 分别查询各类型申请
  if (!type || type === 'authorization') {
    const conditions = [];
    if (status) conditions.push(eq(authorizationApplications.status, status as any));
    if (handlerId) conditions.push(eq(authorizationApplications.handlerId, handlerId));
    if (keyword) {
      conditions.push(
        or(
          like(authorizationApplications.applicationNo, `%${keyword}%`),
          like(authorizationApplications.projectName, `%${keyword}%`),
          like(authorizationApplications.handlerName, `%${keyword}%`)
        )
      );
    }

    const authApps = await db.query.authorizationApplications.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      columns: {
        id: true,
        applicationNo: true,
        projectName: true,
        handlerName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [desc(authorizationApplications.createdAt)],
      limit: type ? pageSize : 100, // 如果只查一种类型，取更多；后面会合并排序
    });

    results.push(...authApps.map(app => ({
      ...app,
      type: 'authorization' as const,
    })));
  }

  if (!type || type === 'sample') {
    const conditions = [];
    if (status) conditions.push(eq(sampleApplications.status, status as any));
    if (handlerId) conditions.push(eq(sampleApplications.handlerId, handlerId));
    if (keyword) {
      conditions.push(
        or(
          like(sampleApplications.applicationNo, `%${keyword}%`),
          like(sampleApplications.projectName, `%${keyword}%`),
          like(sampleApplications.handlerName, `%${keyword}%`)
        )
      );
    }

    const sampleApps = await db.query.sampleApplications.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      columns: {
        id: true,
        applicationNo: true,
        projectName: true,
        handlerName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [desc(sampleApplications.createdAt)],
      limit: type ? pageSize : 100,
    });

    results.push(...sampleApps.map(app => ({
      ...app,
      type: 'sample' as const,
    })));
  }

  if (!type || type === 'price') {
    const conditions = [];
    if (status) conditions.push(eq(priceApplications.status, status as any));
    if (handlerId) conditions.push(eq(priceApplications.handlerId, handlerId));
    if (keyword) {
      conditions.push(
        or(
          like(priceApplications.applicationNo, `%${keyword}%`),
          like(priceApplications.projectName, `%${keyword}%`),
          like(priceApplications.handlerName, `%${keyword}%`)
        )
      );
    }

    const priceApps = await db.query.priceApplications.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      columns: {
        id: true,
        applicationNo: true,
        projectName: true,
        handlerName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [desc(priceApplications.createdAt)],
      limit: type ? pageSize : 100,
    });

    results.push(...priceApps.map(app => ({
      ...app,
      type: 'price' as const,
    })));
  }

  if (!type || type === 'partner') {
    const conditions = [];
    if (status) conditions.push(eq(partnerApplications.status, status as any));
    if (handlerId) conditions.push(eq(partnerApplications.handlerId, handlerId));
    if (keyword) {
      conditions.push(
        or(
          like(partnerApplications.applicationNo, `%${keyword}%`),
          like(partnerApplications.projectName, `%${keyword}%`),
          like(partnerApplications.handlerName, `%${keyword}%`),
          like(partnerApplications.partnerCompanyName, `%${keyword}%`)
        )
      );
    }

    const partnerApps = await db.query.partnerApplications.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      columns: {
        id: true,
        applicationNo: true,
        projectName: true,
        handlerName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [desc(partnerApplications.createdAt)],
      limit: type ? pageSize : 100,
    });

    results.push(...partnerApps.map(app => ({
      ...app,
      type: 'partner' as const,
    })));
  }

  // 按创建时间倒序排序
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // 计算总数
  const total = results.length;

  // 分页
  const startIndex = (page - 1) * pageSize;
  const paginatedResults = results.slice(startIndex, startIndex + pageSize);

  return { items: paginatedResults, total };
}

// ============================================
// 统一申请统计
// ============================================

export interface UnifiedApplicationStatistics {
  total: number;
  byType: {
    authorization: number;
    sample: number;
    price: number;
    partner: number;
  };
  byStatus: {
    draft: number;
    pending_review: number;
    approved: number;
    rejected: number;
    completed: number;
  };
}

export async function getUnifiedApplicationStatistics(): Promise<UnifiedApplicationStatistics> {
  // 各类型数量
  const [{ count: authCount }] = await db
    .select({ count: count() })
    .from(authorizationApplications);

  const [{ count: sampleCount }] = await db
    .select({ count: count() })
    .from(sampleApplications);

  const [{ count: priceCount }] = await db
    .select({ count: count() })
    .from(priceApplications);

  const [{ count: partnerCount }] = await db
    .select({ count: count() })
    .from(partnerApplications);

  // 各状态数量（合并所有类型）
  const authStats = await db
    .select({ status: authorizationApplications.status, count: count() })
    .from(authorizationApplications)
    .groupBy(authorizationApplications.status);

  const sampleStats = await db
    .select({ status: sampleApplications.status, count: count() })
    .from(sampleApplications)
    .groupBy(sampleApplications.status);

  const priceStats = await db
    .select({ status: priceApplications.status, count: count() })
    .from(priceApplications)
    .groupBy(priceApplications.status);

  const partnerStats = await db
    .select({ status: partnerApplications.status, count: count() })
    .from(partnerApplications)
    .groupBy(partnerApplications.status);

  const statusCount: Record<string, number> = {
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
  };

  // 汇总状态
  [...authStats, ...sampleStats, ...priceStats, ...partnerStats].forEach(s => {
    const status = s.status as string;
    if (status in statusCount) {
      statusCount[status] += s.count;
    }
    // 将 material_received, sample_returned, completed 等也计入 completed
    if (['completed', 'material_received', 'sample_returned', 'confirmed', 'material_received'].includes(status)) {
      statusCount.completed += s.count;
    }
  });

  return {
    total: authCount + sampleCount + priceCount + partnerCount,
    byType: {
      authorization: authCount,
      sample: sampleCount,
      price: priceCount,
      partner: partnerCount,
    },
    byStatus: statusCount as any,
  };
}

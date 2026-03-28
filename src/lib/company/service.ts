/**
 * 公司管理服务
 * 提供公司信息和文件的CRUD操作
 */

import { db } from '@/db';
import {
  companies,
  companyFiles,
  companyFileTypeEnum,
  users,
  files,
} from '@/db/schema';
import {
  eq,
  and,
  or,
  like,
  sql,
  desc,
  asc,
  count,
  inArray,
} from 'drizzle-orm';
import type {
  Company,
  NewCompany,
  CompanyFile,
  NewCompanyFile,
} from '@/db/schema';

// ============================================
// 类型定义
// ============================================

export interface CompanyListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  isActive?: boolean;
  industry?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateCompanyData {
  name: string;
  shortName?: string;
  creditCode: string;
  registerAddress: string;
  officeAddress?: string;
  legalPersonName: string;
  legalPersonIdCard?: string;
  agentName?: string;
  agentIdCard?: string;
  contactPersonName: string;
  contactPersonDept?: string;
  contactPersonPosition?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  contactPersonWechat?: string;
  industry?: string;
  companyType?: string;
  registeredCapital?: string;
  establishDate?: Date;
  businessScope?: string;
  bankName?: string;
  bankAccount?: string;
  taxpayerType?: string;
  description?: string;
  remarks?: string;
  isDefault?: boolean;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  isActive?: boolean;
}

export interface CompanyFileListParams {
  companyId: number;
  fileType?: string;
  keyword?: string;
  isActive?: boolean;
}

export interface CreateCompanyFileData {
  companyId: number;
  fileName: string;
  fileType: typeof companyFileTypeEnum.enumValues[number];
  fileId?: number;
  fileUrl?: string;
  fileSize?: string;
  fileExt?: string;
  fileMd5?: string;
  validFrom?: Date;
  validTo?: Date;
  description?: string;
}

// ============================================
// 公司信息管理
// ============================================

/**
 * 获取公司列表
 */
export async function getCompanyList(
  params: CompanyListParams,
  userId: number
): Promise<{ items: Company[]; total: number }> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    isActive,
    industry,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  // 构建查询条件
  const conditions = [eq(companies.createdBy, userId)];

  if (isActive !== undefined) {
    conditions.push(eq(companies.isActive, isActive));
  }

  if (industry) {
    conditions.push(eq(companies.industry, industry));
  }

  // 构建查询
  let query = db
    .select()
    .from(companies)
    .where(and(...conditions));

  // 关键词搜索
  if (keyword) {
    query = db
      .select()
      .from(companies)
      .where(
        and(
          ...conditions,
          or(
            like(companies.name, `%${keyword}%`),
            like(companies.creditCode, `%${keyword}%`),
            like(companies.contactPersonName, `%${keyword}%`)
          )
        )
      );
  }

  // 统计总数
  const [countResult] = await db
    .select({ count: count() })
    .from(companies)
    .where(and(...conditions));

  const total = countResult?.count || 0;

  // 排序
  const orderColumn = sortBy === 'name' ? companies.name : 
                     sortBy === 'updatedAt' ? companies.updatedAt :
                     companies.createdAt;
  const orderBy = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

  // 分页
  const items = await query
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total };
}

/**
 * 获取公司详情
 */
export async function getCompanyById(
  id: number,
  userId: number
): Promise<Company | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, id),
        eq(companies.createdBy, userId)
      )
    )
    .limit(1);

  return company || null;
}

/**
 * 获取默认公司
 */
export async function getDefaultCompany(
  userId: number
): Promise<Company | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.createdBy, userId),
        eq(companies.isDefault, true),
        eq(companies.isActive, true)
      )
    )
    .limit(1);

  return company || null;
}

/**
 * 创建公司
 */
export async function createCompany(
  data: CreateCompanyData,
  userId: number
): Promise<number> {
  // 检查统一社会信用代码是否已存在
  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.creditCode, data.creditCode))
    .limit(1);

  if (existing) {
    throw new Error('该统一社会信用代码已被使用');
  }

  // 如果设为默认公司，先取消其他默认公司
  if (data.isDefault) {
    await db
      .update(companies)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(companies.createdBy, userId));
  }

  const now = new Date();
  const [result] = await db
    .insert(companies)
    .values({
      ...data,
      createdBy: userId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: companies.id });

  return result.id;
}

/**
 * 更新公司
 */
export async function updateCompany(
  id: number,
  data: UpdateCompanyData,
  userId: number
): Promise<boolean> {
  // 检查公司是否存在
  const existing = await getCompanyById(id, userId);
  if (!existing) {
    throw new Error('公司不存在');
  }

  // 如果要修改统一社会信用代码，检查是否重复
  if (data.creditCode && data.creditCode !== existing.creditCode) {
    const [duplicate] = await db
      .select()
      .from(companies)
      .where(
        and(
          eq(companies.creditCode, data.creditCode),
          sql`${companies.id} != ${id}`
        )
      )
      .limit(1);

    if (duplicate) {
      throw new Error('该统一社会信用代码已被使用');
    }
  }

  // 如果设为默认公司，先取消其他默认公司
  if (data.isDefault) {
    await db
      .update(companies)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(companies.createdBy, userId),
          sql`${companies.id} != ${id}`
        )
      );
  }

  await db
    .update(companies)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, id));

  return true;
}

/**
 * 删除公司（软删除）
 */
export async function deleteCompany(
  id: number,
  userId: number
): Promise<boolean> {
  // 检查公司是否存在
  const existing = await getCompanyById(id, userId);
  if (!existing) {
    throw new Error('公司不存在');
  }

  await db
    .update(companies)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(companies.id, id));

  return true;
}

// ============================================
// 公司文件管理
// ============================================

/**
 * 获取公司文件列表
 */
export async function getCompanyFileList(
  params: CompanyFileListParams
): Promise<CompanyFile[]> {
  const { companyId, fileType, keyword, isActive } = params;

  const conditions = [eq(companyFiles.companyId, companyId)];

  if (fileType) {
    conditions.push(eq(companyFiles.fileType, fileType as any));
  }

  if (isActive !== undefined) {
    conditions.push(eq(companyFiles.isActive, isActive));
  }

  let query = db
    .select()
    .from(companyFiles)
    .where(and(...conditions));

  if (keyword) {
    query = db
      .select()
      .from(companyFiles)
      .where(
        and(
          ...conditions,
          like(companyFiles.fileName, `%${keyword}%`)
        )
      );
  }

  return query.orderBy(desc(companyFiles.createdAt));
}

/**
 * 获取公司文件详情
 */
export async function getCompanyFileById(
  id: number,
  companyId: number
): Promise<CompanyFile | null> {
  const [file] = await db
    .select()
    .from(companyFiles)
    .where(
      and(
        eq(companyFiles.id, id),
        eq(companyFiles.companyId, companyId)
      )
    )
    .limit(1);

  return file || null;
}

/**
 * 创建公司文件
 */
export async function createCompanyFile(
  data: CreateCompanyFileData,
  userId: number
): Promise<number> {
  const now = new Date();
  const [result] = await db
    .insert(companyFiles)
    .values({
      ...data,
      uploaderId: userId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: companyFiles.id });

  return result.id;
}

/**
 * 更新公司文件
 */
export async function updateCompanyFile(
  id: number,
  data: {
    fileName?: string;
    fileType?: typeof companyFileTypeEnum.enumValues[number];
    fileId?: number;
    fileUrl?: string;
    fileSize?: string;
    fileExt?: string;
    fileMd5?: string;
    validFrom?: Date | null;
    validTo?: Date | null;
    description?: string | null;
  }
): Promise<boolean> {
  await db
    .update(companyFiles)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(companyFiles.id, id));

  return true;
}

/**
 * 删除公司文件（软删除）
 */
export async function deleteCompanyFile(
  id: number,
  companyId: number
): Promise<boolean> {
  await db
    .update(companyFiles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(companyFiles.id, id),
        eq(companyFiles.companyId, companyId)
      )
    );

  return true;
}

/**
 * 获取即将到期的文件
 */
export async function getExpiringFiles(
  days: number = 30
): Promise<(CompanyFile & { company: Company })[]> {
  const now = new Date();
  const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const results = await db
    .select({
      file: companyFiles,
      company: companies,
    })
    .from(companyFiles)
    .innerJoin(companies, eq(companyFiles.companyId, companies.id))
    .where(
      and(
        eq(companyFiles.isActive, true),
        eq(companies.isActive, true),
        sql`${companyFiles.validTo} <= ${targetDate}`,
        sql`${companyFiles.validTo} >= ${now}`,
        eq(companyFiles.expiryReminded, false)
      )
    );

  return results.map((r: { file: typeof companyFiles.$inferSelect; company: typeof companies.$inferSelect }) => ({
    ...r.file,
    company: r.company,
  }));
}

/**
 * 标记文件已提醒
 */
export async function markFileReminded(
  fileId: number
): Promise<boolean> {
  await db
    .update(companyFiles)
    .set({ expiryReminded: true, updatedAt: new Date() })
    .where(eq(companyFiles.id, fileId));

  return true;
}

// ============================================
// 统计分析
// ============================================

/**
 * 获取公司统计信息
 */
export async function getCompanyStats(
  userId: number
): Promise<{
  total: number;
  active: number;
  inactive: number;
  defaultCompanyId: number | null;
  totalFiles: number;
}> {
  // 总数统计
  const [totalResult] = await db
    .select({ count: count() })
    .from(companies)
    .where(eq(companies.createdBy, userId));

  // 启用数统计
  const [activeResult] = await db
    .select({ count: count() })
    .from(companies)
    .where(
      and(
        eq(companies.createdBy, userId),
        eq(companies.isActive, true)
      )
    );

  // 获取默认公司
  const defaultCompany = await getDefaultCompany(userId);

  // 获取文件总数
  const companyIds = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.createdBy, userId));

  let totalFiles = 0;
  if (companyIds.length > 0) {
    const [fileCount] = await db
      .select({ count: count() })
      .from(companyFiles)
      .where(
        and(
          inArray(companyFiles.companyId, companyIds.map((c) => c.id)),
          eq(companyFiles.isActive, true)
        )
      );
    totalFiles = fileCount?.count || 0;
  }

  return {
    total: totalResult?.count || 0,
    active: activeResult?.count || 0,
    inactive: (totalResult?.count || 0) - (activeResult?.count || 0),
    defaultCompanyId: defaultCompany?.id || null,
    totalFiles,
  };
}

/**
 * 获取文件类型统计
 */
export async function getFileTypeStats(
  companyId: number
): Promise<Record<string, number>> {
  const results = await db
    .select({
      fileType: companyFiles.fileType,
      count: count(),
    })
    .from(companyFiles)
    .where(
      and(
        eq(companyFiles.companyId, companyId),
        eq(companyFiles.isActive, true)
      )
    )
    .groupBy(companyFiles.fileType);

  const stats: Record<string, number> = {};
  for (const r of results) {
    stats[r.fileType] = r.count;
  }

  return stats;
}

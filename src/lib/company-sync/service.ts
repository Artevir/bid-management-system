/**
 * 公司信息联动服务
 * 实现公司信息与投标全流程各模块的数据联动
 * 
 * 核心功能：
 * 1. 获取公司完整信息（对接人、资质文件、文档框架等）
 * 2. 根据业务场景获取关键信息（盖章地址、对接人等）
 * 3. 公司信息同步到各业务模块
 * 4. 公司使用情况统计分析
 */

import { db } from '@/db';
import {
  companies,
  companyContacts,
  companyFiles,
  companyDocumentFrameworks,
  companyFrameworkChapters,
  projects as _projects,
  bidArchives,
  bidDocumentPurchases,
  bidPrintings,
  bidSealApplications,
  authorizationManufacturers,
  partnerApplications,
  bidChapters as _bidChapters,
  docFrameworks as _docFrameworks,
  users as _users,
} from '@/db/schema';
import {
  eq,
  and,
  or,
  like,
  desc,
  asc,
  inArray as _inArray,
  sql,
  count,
  isNotNull,
  isNull as _isNull,
} from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

/**
 * 公司完整信息
 */
export interface CompanyFullInfo {
  company: {
    id: number;
    name: string;
    shortName: string | null;
    creditCode: string;
    registerAddress: string;
    officeAddress: string | null;
    legalPersonName: string;
    legalPersonIdCard: string | null;
    agentName: string | null;
    agentIdCard: string | null;
    contactPersonName: string;
    contactPersonDept: string | null;
    contactPersonPosition: string | null;
    contactPersonPhone: string | null;
    contactPersonEmail: string | null;
    contactPersonWechat: string | null;
    industry: string | null;
    companyType: string | null;
    registeredCapital: string | null;
    establishDate: Date | null;
    businessScope: string | null;
    bankName: string | null;
    bankAccount: string | null;
    taxpayerType: string | null;
    description: string | null;
    remarks: string | null;
    isDefault: boolean | null;
    isActive: boolean | null;
  };
  contacts: CompanyContactInfo[];
  files: CompanyFileInfo[];
  frameworks: CompanyFrameworkInfo[];
  usage: CompanyUsageStats | null;
}

export interface CompanyContactInfo {
  id: number;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  telephone: string | null;
  wechat: string | null;
  qq: string | null;
  email: string | null;
  roles: any[]; // JSON解析后的角色数组
  isPrimary: boolean | null;
  isActive: boolean | null;
  remarks: string | null;
}

export interface CompanyFileInfo {
  id: number;
  fileName: string;
  fileType: string;
  fileUrl: string | null;
  fileSize: string | null;
  fileExt: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  expiryReminded: boolean | null;
  description: string | null;
  isActive: boolean | null;
  isExpired: boolean;
  daysToExpiry: number | null;
}

export interface CompanyFrameworkInfo {
  id: number;
  name: string;
  description: string | null;
  documentType: string;
  sourceType: string;
  isDefault: boolean;
  isActive: boolean;
  chapterCount: number;
}

export interface CompanyUsageStats {
  projectCount: number;
  archiveCount: number;
  purchaseCount: number;
  printingCount: number;
  sealApplicationCount: number;
  authorizationCount: number;
  partnerApplicationCount: number;
  lastUsedAt: Date | null;
}

/**
 * 业务场景信息
 */
export interface CompanyInfoForSeal {
  companyId: number;
  companyName: string;
  // 地址（优先办公地址，其次注册地址）
  address: string;
  // 对接人信息
  contacts: {
    id: number;
    name: string;
    phone: string | null;
    wechat: string | null;
    isPrimary: boolean;
  }[];
  // 法定代表人信息
  legalPerson: {
    name: string;
    idCard: string | null;
  };
  // 代理人信息
  agent: {
    name: string | null;
    idCard: string | null;
  };
}

export interface CompanyInfoForBid {
  companyId: number;
  companyName: string;
  shortName: string | null;
  creditCode: string;
  // 地址信息
  registerAddress: string;
  officeAddress: string | null;
  // 法人信息
  legalPersonName: string;
  legalPersonIdCard: string | null;
  // 代理人信息
  agentName: string | null;
  agentIdCard: string | null;
  // 接口人信息
  contactPerson: {
    name: string;
    dept: string | null;
    position: string | null;
    phone: string | null;
    email: string | null;
    wechat: string | null;
  };
  // 银行信息
  bankInfo: {
    bankName: string | null;
    bankAccount: string | null;
  };
}

export interface CompanyInfoForAuthorization {
  companyId: number;
  companyName: string;
  creditCode: string;
  address: string;
  // 联系人信息
  contacts: {
    name: string;
    phone: string | null;
    email: string | null;
  }[];
}

// ============================================
// 核心服务函数
// ============================================

/**
 * 获取公司完整信息
 */
export async function getCompanyFullInfo(companyId: number): Promise<CompanyFullInfo | null> {
  // 查询公司基本信息
  const companyResult = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (companyResult.length === 0) {
    return null;
  }

  const company = companyResult[0];

  // 查询对接人
  const contactsResult = await db
    .select()
    .from(companyContacts)
    .where(eq(companyContacts.companyId, companyId))
    .orderBy(desc(companyContacts.isPrimary), asc(companyContacts.name));

  // 查询资质文件
  const filesResult = await db
    .select()
    .from(companyFiles)
    .where(eq(companyFiles.companyId, companyId))
    .orderBy(desc(companyFiles.validTo));

  // 查询文档框架
  const frameworksResult = await db
    .select({
      id: companyDocumentFrameworks.id,
      name: companyDocumentFrameworks.name,
      description: companyDocumentFrameworks.description,
      documentType: companyDocumentFrameworks.documentType,
      sourceType: companyDocumentFrameworks.sourceType,
      isDefault: companyDocumentFrameworks.isDefault,
      isActive: companyDocumentFrameworks.isActive,
      chapterCount: sql<number>`(SELECT COUNT(*) FROM ${companyFrameworkChapters} WHERE ${companyFrameworkChapters.frameworkId} = ${companyDocumentFrameworks.id})`,
    })
    .from(companyDocumentFrameworks)
    .where(eq(companyDocumentFrameworks.companyId, companyId))
    .orderBy(desc(companyDocumentFrameworks.isDefault), desc(companyDocumentFrameworks.createdAt));

  // 获取使用情况统计
  const usageStats = await getCompanyUsageStats(companyId);

  // 处理文件到期状态
  const now = new Date();
  const processedFiles: CompanyFileInfo[] = filesResult.map((file) => {
    const validTo = file.validTo;
    const isExpired = validTo ? new Date(validTo) < now : false;
    const daysToExpiry = validTo
      ? Math.ceil((new Date(validTo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...file,
      roles: [],
      isExpired,
      daysToExpiry: isExpired ? null : daysToExpiry,
    };
  });

  // 处理对接人角色
  const processedContacts: CompanyContactInfo[] = contactsResult.map((contact) => ({
    ...contact,
    roles: contact.roles ? JSON.parse(contact.roles) : [],
  }));

  return {
    company: {
      id: company.id,
      name: company.name,
      shortName: company.shortName,
      creditCode: company.creditCode,
      registerAddress: company.registerAddress,
      officeAddress: company.officeAddress,
      legalPersonName: company.legalPersonName,
      legalPersonIdCard: company.legalPersonIdCard,
      agentName: company.agentName,
      agentIdCard: company.agentIdCard,
      contactPersonName: company.contactPersonName,
      contactPersonDept: company.contactPersonDept,
      contactPersonPosition: company.contactPersonPosition,
      contactPersonPhone: company.contactPersonPhone,
      contactPersonEmail: company.contactPersonEmail,
      contactPersonWechat: company.contactPersonWechat,
      industry: company.industry,
      companyType: company.companyType,
      registeredCapital: company.registeredCapital,
      establishDate: company.establishDate,
      businessScope: company.businessScope,
      bankName: company.bankName,
      bankAccount: company.bankAccount,
      taxpayerType: company.taxpayerType,
      description: company.description,
      remarks: company.remarks,
      isDefault: company.isDefault,
      isActive: company.isActive,
    },
    contacts: processedContacts,
    files: processedFiles,
    frameworks: frameworksResult as CompanyFrameworkInfo[],
    usage: usageStats,
  };
}

/**
 * 获取公司使用情况统计
 */
export async function getCompanyUsageStats(companyId: number): Promise<CompanyUsageStats> {
  // 归档关联数
  const archiveCount = await db
    .select({ count: count() })
    .from(bidArchives)
    .where(eq(bidArchives.companyId, companyId));

  // 买标书关联数
  const purchaseCount = await db
    .select({ count: count() })
    .from(bidDocumentPurchases)
    .where(eq(bidDocumentPurchases.partnerCompanyId, companyId));

  // 打印关联数
  const printingCount = await db
    .select({ count: count() })
    .from(bidPrintings)
    .where(eq(bidPrintings.partnerCompanyId, companyId));

  // 盖章申请关联数
  const sealApplicationCount = await db
    .select({ count: count() })
    .from(bidSealApplications)
    .where(eq(bidSealApplications.partnerCompanyId, companyId));

  // 授权厂家关联数
  const authorizationCount = await db
    .select({ count: count() })
    .from(authorizationManufacturers)
    .where(eq(authorizationManufacturers.companyId, companyId));

  // 友司支持关联数
  const partnerApplicationCount = await db
    .select({ count: count() })
    .from(partnerApplications)
    .where(eq(partnerApplications.partnerCompanyId, companyId));

  // 最近使用时间 - 从归档表获取
  const lastUsedResult = await db
    .select({ updatedAt: bidArchives.updatedAt })
    .from(bidArchives)
    .where(eq(bidArchives.companyId, companyId))
    .orderBy(desc(bidArchives.updatedAt))
    .limit(1);

  // 计算总项目数（从各业务关联）
  const totalUsage = 
    (archiveCount[0]?.count || 0) +
    (purchaseCount[0]?.count || 0) +
    (printingCount[0]?.count || 0) +
    (sealApplicationCount[0]?.count || 0);

  return {
    projectCount: totalUsage, // 用总使用量代替项目数
    archiveCount: archiveCount[0]?.count || 0,
    purchaseCount: purchaseCount[0]?.count || 0,
    printingCount: printingCount[0]?.count || 0,
    sealApplicationCount: sealApplicationCount[0]?.count || 0,
    authorizationCount: authorizationCount[0]?.count || 0,
    partnerApplicationCount: partnerApplicationCount[0]?.count || 0,
    lastUsedAt: lastUsedResult[0]?.updatedAt || null,
  };
}

/**
 * 获取盖章场景所需的公司信息
 * 用于盖章申请时获取友司地址和对接人
 */
export async function getCompanyInfoForSeal(companyId: number): Promise<CompanyInfoForSeal | null> {
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (company.length === 0) {
    return null;
  }

  const c = company[0];

  // 获取对接人
  const contacts = await db
    .select({
      id: companyContacts.id,
      name: companyContacts.name,
      phone: companyContacts.phone,
      wechat: companyContacts.wechat,
      isPrimary: companyContacts.isPrimary,
    })
    .from(companyContacts)
    .where(
      and(
        eq(companyContacts.companyId, companyId),
        eq(companyContacts.isActive, true)
      )
    )
    .orderBy(desc(companyContacts.isPrimary));

  return {
    companyId: c.id,
    companyName: c.name,
    // 优先使用办公地址，其次使用注册地址
    address: c.officeAddress || c.registerAddress,
    contacts: contacts.map((ct) => ({
      id: ct.id,
      name: ct.name,
      phone: ct.phone,
      wechat: ct.wechat,
      isPrimary: ct.isPrimary || false,
    })),
    legalPerson: {
      name: c.legalPersonName,
      idCard: c.legalPersonIdCard,
    },
    agent: {
      name: c.agentName,
      idCard: c.agentIdCard,
    },
  };
}

/**
 * 获取投标场景所需的公司信息
 * 用于投标文件编制、报价等场景
 */
export async function getCompanyInfoForBid(companyId: number): Promise<CompanyInfoForBid | null> {
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (company.length === 0) {
    return null;
  }

  const c = company[0];

  return {
    companyId: c.id,
    companyName: c.name,
    shortName: c.shortName,
    creditCode: c.creditCode,
    registerAddress: c.registerAddress,
    officeAddress: c.officeAddress,
    legalPersonName: c.legalPersonName,
    legalPersonIdCard: c.legalPersonIdCard,
    agentName: c.agentName,
    agentIdCard: c.agentIdCard,
    contactPerson: {
      name: c.contactPersonName,
      dept: c.contactPersonDept,
      position: c.contactPersonPosition,
      phone: c.contactPersonPhone,
      email: c.contactPersonEmail,
      wechat: c.contactPersonWechat,
    },
    bankInfo: {
      bankName: c.bankName,
      bankAccount: c.bankAccount,
    },
  };
}

/**
 * 获取授权申请场景所需的公司信息
 * 用于厂家授权申请
 */
export async function getCompanyInfoForAuthorization(companyId: number): Promise<CompanyInfoForAuthorization | null> {
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (company.length === 0) {
    return null;
  }

  const c = company[0];

  // 获取对接人
  const contacts = await db
    .select({
      name: companyContacts.name,
      phone: companyContacts.phone,
      email: companyContacts.email,
    })
    .from(companyContacts)
    .where(
      and(
        eq(companyContacts.companyId, companyId),
        eq(companyContacts.isActive, true)
      )
    )
    .orderBy(desc(companyContacts.isPrimary))
    .limit(3);

  return {
    companyId: c.id,
    companyName: c.name,
    creditCode: c.creditCode,
    address: c.officeAddress || c.registerAddress,
    contacts: contacts.map((ct) => ({
      name: ct.name,
      phone: ct.phone,
      email: ct.email,
    })),
  };
}

/**
 * 获取公司主要对接人
 */
export async function getCompanyPrimaryContact(companyId: number): Promise<CompanyContactInfo | null> {
  const contact = await db
    .select()
    .from(companyContacts)
    .where(
      and(
        eq(companyContacts.companyId, companyId),
        eq(companyContacts.isActive, true),
        eq(companyContacts.isPrimary, true)
      )
    )
    .limit(1);

  if (contact.length === 0) {
    // 如果没有主要对接人，获取第一个活跃的对接人
    const fallbackContact = await db
      .select()
      .from(companyContacts)
      .where(
        and(
          eq(companyContacts.companyId, companyId),
          eq(companyContacts.isActive, true)
        )
      )
      .limit(1);

    if (fallbackContact.length === 0) {
      return null;
    }

    return {
      ...fallbackContact[0],
      roles: fallbackContact[0].roles ? JSON.parse(fallbackContact[0].roles) : [],
    };
  }

  return {
    ...contact[0],
    roles: contact[0].roles ? JSON.parse(contact[0].roles) : [],
  };
}

/**
 * 获取公司资质文件（按类型）
 */
export async function getCompanyFilesByType(
  companyId: number,
  fileType?: string
): Promise<CompanyFileInfo[]> {
  const conditions = [eq(companyFiles.companyId, companyId)];
  
  if (fileType) {
    conditions.push(eq(companyFiles.fileType, fileType as any));
  }

  const filesResult = await db
    .select()
    .from(companyFiles)
    .where(and(...conditions))
    .orderBy(desc(companyFiles.validTo));

  const now = new Date();
  return filesResult.map((file) => {
    const validTo = file.validTo;
    const isExpired = validTo ? new Date(validTo) < now : false;
    const daysToExpiry = validTo
      ? Math.ceil((new Date(validTo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...file,
      roles: [],
      isExpired,
      daysToExpiry: isExpired ? null : daysToExpiry,
    };
  });
}

/**
 * 获取公司默认文档框架
 */
export async function getCompanyDefaultFramework(companyId: number, documentType?: string) {
  const conditions = [
    eq(companyDocumentFrameworks.companyId, companyId),
    eq(companyDocumentFrameworks.isDefault, true),
    eq(companyDocumentFrameworks.isActive, true),
  ];

  if (documentType) {
    conditions.push(eq(companyDocumentFrameworks.documentType, documentType as any));
  }

  const framework = await db
    .select()
    .from(companyDocumentFrameworks)
    .where(and(...conditions))
    .limit(1);

  if (framework.length === 0) {
    return null;
  }

  // 获取框架章节
  const chapters = await db
    .select()
    .from(companyFrameworkChapters)
    .where(eq(companyFrameworkChapters.frameworkId, framework[0].id))
    .orderBy(asc(companyFrameworkChapters.level), asc(companyFrameworkChapters.order));

  return {
    ...framework[0],
    chapters,
  };
}

/**
 * 获取即将到期的资质文件
 */
export async function getExpiringFiles(daysThreshold: number = 30): Promise<{
  company: { id: number; name: string };
  file: CompanyFileInfo;
}[]> {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  const result = await db
    .select({
      companyId: companyFiles.companyId,
      companyName: companies.name,
      fileId: companyFiles.id,
      fileName: companyFiles.fileName,
      fileType: companyFiles.fileType,
      fileUrl: companyFiles.fileUrl,
      fileSize: companyFiles.fileSize,
      fileExt: companyFiles.fileExt,
      validFrom: companyFiles.validFrom,
      validTo: companyFiles.validTo,
      expiryReminded: companyFiles.expiryReminded,
      description: companyFiles.description,
      isActive: companyFiles.isActive,
    })
    .from(companyFiles)
    .innerJoin(companies, eq(companyFiles.companyId, companies.id))
    .where(
      and(
        eq(companyFiles.isActive, true),
        isNotNull(companyFiles.validTo),
        sql`${companyFiles.validTo} <= ${thresholdDate}`,
        sql`${companyFiles.validTo} >= ${now}`
      )
    )
    .orderBy(asc(companyFiles.validTo));

  return result.map((row) => ({
    company: {
      id: row.companyId,
      name: row.companyName,
    },
    file: {
      id: row.fileId,
      fileName: row.fileName,
      fileType: row.fileType,
      fileUrl: row.fileUrl,
      fileSize: row.fileSize,
      fileExt: row.fileExt,
      validFrom: row.validFrom,
      validTo: row.validTo,
      expiryReminded: row.expiryReminded,
      description: row.description,
      isActive: row.isActive,
      isExpired: false,
      daysToExpiry: row.validTo
        ? Math.ceil((new Date(row.validTo).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    },
  }));
}

/**
 * 搜索公司（支持模糊匹配）
 */
export async function searchCompanies(
  keyword: string,
  limit: number = 10
): Promise<{ id: number; name: string; creditCode: string; isActive: boolean | null }[]> {
  const result = await db
    .select({
      id: companies.id,
      name: companies.name,
      creditCode: companies.creditCode,
      isActive: companies.isActive,
    })
    .from(companies)
    .where(
      and(
        eq(companies.isActive, true),
        or(
          like(companies.name, `%${keyword}%`),
          like(companies.shortName, `%${keyword}%`),
          like(companies.creditCode, `%${keyword}%`)
        )
      )
    )
    .orderBy(desc(companies.isDefault), asc(companies.name))
    .limit(limit);

  return result;
}

/**
 * 同步公司信息到归档
 * 将公司的关键信息同步到标书归档记录
 */
export async function syncCompanyToArchive(archiveId: number, companyId: number): Promise<{
  success: boolean;
  message: string;
  updatedFields: string[];
}> {
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (company.length === 0) {
    return {
      success: false,
      message: '公司不存在',
      updatedFields: [],
    };
  }

  const c = company[0];
  const updatedFields: string[] = [];

  // 获取当前归档信息
  const archive = await db
    .select()
    .from(bidArchives)
    .where(eq(bidArchives.id, archiveId))
    .limit(1);

  if (archive.length === 0) {
    return {
      success: false,
      message: '归档记录不存在',
      updatedFields: [],
    };
  }

  // 构建更新数据
  const updateData: Record<string, any> = {
    companyId: c.id,
    companyName: c.name,
  };

  updatedFields.push('companyName');

  // 执行更新
  await db
    .update(bidArchives)
    .set(updateData)
    .where(eq(bidArchives.id, archiveId));

  return {
    success: true,
    message: `已同步 ${updatedFields.length} 个字段`,
    updatedFields,
  };
}

/**
 * 获取公司列表（简化版，用于下拉选择）
 */
export async function getCompanyListSimple(filters?: {
  isActive?: boolean;
  keyword?: string;
}): Promise<{ id: number; name: string; shortName: string | null; creditCode: string }[]> {
  const conditions = [];

  if (filters?.isActive !== undefined) {
    conditions.push(eq(companies.isActive, filters.isActive));
  }

  if (filters?.keyword) {
    conditions.push(
      or(
        like(companies.name, `%${filters.keyword}%`),
        like(companies.shortName, `%${filters.keyword}%`),
        like(companies.creditCode, `%${filters.keyword}%`)
      )
    );
  }

  const result = await db
    .select({
      id: companies.id,
      name: companies.name,
      shortName: companies.shortName,
      creditCode: companies.creditCode,
    })
    .from(companies)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(companies.isDefault), asc(companies.name));

  return result;
}

/**
 * 获取默认公司
 */
export async function getDefaultCompany(): Promise<{ id: number; name: string } | null> {
  const result = await db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .where(
      and(
        eq(companies.isDefault, true),
        eq(companies.isActive, true)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * 招标文件解读服务
 * 提供文件上传、解析、信息提取、导出等核心功能
 */

import { db } from '@/db';
import {
  bidDocumentInterpretations,
  bidTechnicalSpecs,
  bidScoringItems,
  bidRequirementChecklist,
  bidDocumentFramework,
  bidInterpretationLogs,
  bidTimeReminders,
  files as _files,
} from '@/db/schema';
import { eq, and, desc, like as _like, sql, inArray, isNull as _isNull } from 'drizzle-orm';
import { extractTextFromDocumentBuffer } from '@/lib/document/text-extractor';
import { generateWithDefaultLLM } from '@/lib/llm/db-runtime';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { S3Storage } from 'coze-coding-dev-sdk';

// ============================================
// 类型定义
// ============================================

export type InterpretationStatus = 'pending' | 'parsing' | 'completed' | 'failed';
export type DocumentExt = 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx';

export interface CreateInterpretationParams {
  documentName: string;
  documentUrl: string;
  documentExt: DocumentExt;
  documentSize?: number;
  documentMd5: string;
  documentPageCount?: number;
  uploaderId: number;
  projectId?: number;
}

export interface InterpretationListParams {
  status?: InterpretationStatus;
  keyword?: string;
  uploaderId?: number;
  projectId?: number;
  page?: number;
  pageSize?: number;
}

export interface UpdateInterpretationParams {
  projectName?: string;
  projectCode?: string;
  tenderOrganization?: string;
  tenderAgent?: string;
  projectBudget?: string;
  tags?: string[];
  expireTime?: Date;
}

export interface ParseResult {
  basicInfo: Record<string, unknown>;
  timeNodes: Record<string, unknown>[];
  submissionRequirements: Record<string, unknown>;
  feeInfo: Record<string, unknown>;
  qualificationRequirements: Record<string, unknown>[];
  personnelRequirements: Record<string, unknown>[];
  technicalSpecs: TechnicalSpecItem[];
  scoringItems: ScoringItemData[];
  docRequirements: Record<string, unknown>;
  otherRequirements: Record<string, unknown>;
  documentFramework: FrameworkItem[];
}

export interface TechnicalSpecItem {
  specCategory: string;
  specSubCategory?: string;
  specName: string;
  specValue?: string;
  specUnit?: string;
  specRequirement?: string;
  minValue?: string;
  maxValue?: string;
  allowableDeviation?: string;
  isKeyParam?: boolean;
  isMandatory?: boolean;
  originalText?: string;
  pageNumber?: number;
}

export interface ScoringItemData {
  scoringCategory: string;
  scoringSubCategory?: string;
  itemName: string;
  itemDescription?: string;
  serialNumber?: string;
  maxScore: number;
  minScore?: number;
  scoringMethod?: string;
  scoringCriteria?: string;
  deductionRules?: Record<string, unknown>[];
  bonusRules?: Record<string, unknown>[];
  originalText?: string;
  pageNumber?: number;
}

export interface FrameworkItem {
  chapterNumber?: string;
  chapterTitle: string;
  chapterType?: string;
  level: number;
  parentId?: number;
  contentRequirement?: string;
  formatRequirement?: string;
  pageLimit?: number;
  originalText?: string;
  pageNumber?: number;
  children?: FrameworkItem[];
}

// ============================================
// 解读记录管理
// ============================================

/**
 * 创建解读记录
 */
export async function createInterpretation(
  params: CreateInterpretationParams
): Promise<number> {
  // 检查是否已存在相同MD5的文件
  const existing = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.documentMd5, params.documentMd5))
    .limit(1);

  if (existing.length > 0) {
    const item = existing[0];
    if (item.status === 'completed') {
      throw new Error('该招标文件已上传并解读过，请勿重复上传');
    }

    await db
      .update(bidDocumentInterpretations)
      .set({
        documentName: params.documentName,
        documentUrl: params.documentUrl,
        documentExt: params.documentExt,
        documentSize: params.documentSize,
        documentPageCount: params.documentPageCount,
        uploaderId: params.uploaderId,
        projectId: params.projectId,
        status: 'pending',
        parseProgress: 0,
        parseError: null,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, item.id));

    await createInterpretationLog(item.id, 'reupload', '重新上传招标文件（覆盖未完成记录）', params.uploaderId);
    return item.id;
  }

  const result = await db
    .insert(bidDocumentInterpretations)
    .values({
      documentName: params.documentName,
      documentUrl: params.documentUrl,
      documentExt: params.documentExt,
      documentSize: params.documentSize,
      documentMd5: params.documentMd5,
      documentPageCount: params.documentPageCount,
      uploaderId: params.uploaderId,
      projectId: params.projectId,
      status: 'pending',
    })
    .returning({ id: bidDocumentInterpretations.id });

  // 记录日志
  await createInterpretationLog(result[0].id, 'create', '上传招标文件', params.uploaderId);

  return result[0].id;
}

/**
 * 获取解读记录详情
 */
export async function getInterpretationById(id: number) {
  const interpretation = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.id, id))
    .limit(1);

  if (!interpretation[0]) {
    return null;
  }

  const item = interpretation[0];

  // 解析JSON字段
  return {
    ...item,
    basicInfo: item.basicInfo ? JSON.parse(item.basicInfo) : null,
    timeNodes: item.timeNodes ? JSON.parse(item.timeNodes) : null,
    submissionRequirements: item.submissionRequirements ? JSON.parse(item.submissionRequirements) : null,
    feeInfo: item.feeInfo ? JSON.parse(item.feeInfo) : null,
    qualificationRequirements: item.qualificationRequirements ? JSON.parse(item.qualificationRequirements) : null,
    personnelRequirements: item.personnelRequirements ? JSON.parse(item.personnelRequirements) : null,
    docRequirements: item.docRequirements ? JSON.parse(item.docRequirements) : null,
    otherRequirements: item.otherRequirements ? JSON.parse(item.otherRequirements) : null,
    tags: item.tags ? JSON.parse(item.tags) : [],
  };
}

/**
 * 获取解读记录列表
 */
export async function getInterpretationList(params: InterpretationListParams = {}) {
  const { status, keyword, uploaderId, projectId, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (status) {
    conditions.push(eq(bidDocumentInterpretations.status, status));
  }

  if (keyword) {
    conditions.push(
      sql`(${bidDocumentInterpretations.documentName} ILIKE ${`%${keyword}%`} OR ${bidDocumentInterpretations.projectName} ILIKE ${`%${keyword}%`} OR ${bidDocumentInterpretations.tenderOrganization} ILIKE ${`%${keyword}%`})`
    );
  }

  if (uploaderId) {
    conditions.push(eq(bidDocumentInterpretations.uploaderId, uploaderId));
  }

  if (projectId) {
    conditions.push(eq(bidDocumentInterpretations.projectId, projectId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(bidDocumentInterpretations)
    .where(whereClause);

  const total = Number(countResult[0]?.count || 0);

  // 获取列表
  const list = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(whereClause)
    .orderBy(desc(bidDocumentInterpretations.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    list: list.map(item => ({
      ...item,
      tags: item.tags ? JSON.parse(item.tags) : [],
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 更新解读记录
 */
export async function updateInterpretation(
  id: number,
  params: UpdateInterpretationParams,
  operatorId: number
): Promise<void> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.projectName !== undefined) updateData.projectName = params.projectName;
  if (params.projectCode !== undefined) updateData.projectCode = params.projectCode;
  if (params.tenderOrganization !== undefined) updateData.tenderOrganization = params.tenderOrganization;
  if (params.tenderAgent !== undefined) updateData.tenderAgent = params.tenderAgent;
  if (params.projectBudget !== undefined) updateData.projectBudget = params.projectBudget;
  if (params.tags !== undefined) updateData.tags = JSON.stringify(params.tags);
  if (params.expireTime !== undefined) updateData.expireTime = params.expireTime;

  await db
    .update(bidDocumentInterpretations)
    .set(updateData)
    .where(eq(bidDocumentInterpretations.id, id));

  // 记录日志
  await createInterpretationLog(id, 'update', '更新解读信息', operatorId);
}

/**
 * 删除解读记录
 */
export async function deleteInterpretation(id: number, operatorId: number): Promise<void> {
  // 先记录日志
  await createInterpretationLog(id, 'delete', '删除解读记录', operatorId);

  // 删除关联数据（级联删除会自动处理）
  await db.delete(bidDocumentInterpretations).where(eq(bidDocumentInterpretations.id, id));
}

/**
 * 批量删除解读记录
 */
export async function batchDeleteInterpretations(ids: number[], operatorId: number): Promise<void> {
  for (const id of ids) {
    await createInterpretationLog(id, 'delete', '批量删除解读记录', operatorId);
  }

  await db.delete(bidDocumentInterpretations).where(inArray(bidDocumentInterpretations.id, ids));
}

// ============================================
// 文件解析
// ============================================

/**
 * 计算文件MD5
 */
export function calculateFileMd5(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

async function loadDocumentBuffer(documentUrl: string): Promise<Buffer> {
  const urlMatch = documentUrl.match(/\/api\/files\/(\d+)\/(raw|download)(\?.*)?$/);
  if (urlMatch) {
    const fileId = parseInt(urlMatch[1], 10);
    const [file] = await db
      .select({
        path: _files.path,
        originalName: _files.originalName,
        mimeType: _files.mimeType,
      })
      .from(_files)
      .where(eq(_files.id, fileId))
      .limit(1);

    if (!file) {
      throw new Error('文档读取失败: 文件不存在');
    }

    if (process.env.COZE_BUCKET_ENDPOINT_URL && process.env.COZE_BUCKET_NAME) {
      const storage = new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: '',
        secretKey: '',
        bucketName: process.env.COZE_BUCKET_NAME,
        region: 'cn-beijing',
      });
      const signedUrl = await storage.generatePresignedUrl({
        key: file.path,
        expireTime: 3600,
      });
      const res = await fetch(signedUrl, { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`文档读取失败: ${res.status} ${text}`.slice(0, 400));
      }
      return Buffer.from(await res.arrayBuffer());
    }

    const absolutePath = path.resolve(process.cwd(), file.path);
    const uploadsRoot = path.resolve(process.cwd(), 'uploads') + path.sep;
    if (!absolutePath.startsWith(uploadsRoot)) {
      throw new Error('文档读取失败: 非法文件路径');
    }

    return fs.readFileSync(absolutePath);
  }

  const res = await fetch(documentUrl, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`文档读取失败: ${res.status} ${text}`.slice(0, 400));
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * 使用LLM解析招标文件
 */
export async function parseDocumentWithLLM(
  documentUrl: string,
  documentExt: DocumentExt,
  customHeaders?: Record<string, string>
): Promise<ParseResult> {
  const buffer = await loadDocumentBuffer(documentUrl);
  const textContent = await extractTextFromDocumentBuffer(buffer, documentExt);
  if (!textContent) {
    throw new Error('文档解析失败：无法提取文本内容');
  }

  const systemPrompt = `你是一个专业的招标文件解析专家。你的任务是从招标文件中提取关键信息，并以JSON格式返回。

请按照以下格式返回JSON结果：
{
  "basicInfo": {
    "projectName": "项目名称",
    "projectCode": "项目编号",
    "tenderOrganization": "招标单位",
    "tenderAgent": "招标代理机构",
    "projectBudget": "项目预算",
    "projectOverview": "项目概况",
    "fundSource": "资金来源",
    "projectLocation": "项目地点",
    "tenderMethod": "招标方式",
    "tenderScope": "招标范围"
  },
  "timeNodes": [
    {
      "name": "时间节点名称",
      "time": "具体时间",
      "location": "地点（如适用）"
    }
  ],
  "submissionRequirements": {
    "submissionMethod": "提交方式",
    "submissionLocation": "提交地点",
    "contactPerson": "联系人",
    "contactPhone": "联系电话",
    "copiesRequired": "正本副本数量",
    "sealingRequirements": "密封要求"
  },
  "feeInfo": {
    "documentFee": "招标文件购买费用",
    "documentFeeDeadline": "缴纳截止时间",
    "bidBond": "投标保证金",
    "bidBondMethod": "缴纳方式",
    "bidBondDeadline": "保证金缴纳截止时间",
    "bidBondRefundCondition": "退还条件",
    "performanceBond": "履约保证金"
  },
  "qualificationRequirements": [
    {
      "type": "资质类型",
      "requirement": "具体要求",
      "isRequired": true
    }
  ],
  "personnelRequirements": [
    {
      "position": "岗位",
      "qualification": "资质要求",
      "experience": "经验要求"
    }
  ],
  "technicalSpecs": [
    {
      "specCategory": "规格分类",
      "specName": "规格名称",
      "specValue": "规格值",
      "specUnit": "单位",
      "specRequirement": "要求描述",
      "isKeyParam": false,
      "isMandatory": true
    }
  ],
  "scoringItems": [
    {
      "scoringCategory": "评分分类（商务/技术/报价）",
      "itemName": "评分项名称",
      "maxScore": 10,
      "scoringCriteria": "评分标准",
      "scoringMethod": "评分方法"
    }
  ],
  "docRequirements": {
    "docContent": "投标文件内容要求",
    "docFormat": "格式要求",
    "signRequirement": "签章要求"
  },
  "otherRequirements": {
    "consortiumRequirement": "联合体要求",
    "performanceRequirement": "业绩要求",
    "afterSalesRequirement": "售后服务要求",
    "paymentMethod": "付款方式"
  },
  "documentFramework": [
    {
      "chapterNumber": "第一章",
      "chapterTitle": "章节标题",
      "chapterType": "章节类型",
      "level": 1,
      "contentRequirement": "内容要求"
    }
  ]
}

请仔细阅读文档，提取所有关键信息。注意：
1. 时间节点要精确到具体日期和时间
2. 资格条件要区分必须满足的和可选的
3. 评分项要标注分值和评分方法
4. 技术参数要注明是否为关键参数
5. 对不确定的内容，请标注"待确认"`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请解析以下招标文件内容：\n\n${textContent}` },
  ];

  try {
    const response = await generateWithDefaultLLM(messages as any);

    // 解析JSON响应
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ParseResult;
    }

    throw new Error('无法解析LLM响应');
  } catch (error) {
    console.error('LLM parse error:', error);
    throw error;
  }
}

/**
 * 执行解读任务
 */
export async function executeInterpretation(
  id: number,
  customHeaders?: Record<string, string>
): Promise<void> {
  const interpretation = await getInterpretationById(id);
  if (!interpretation) {
    throw new Error('解读记录不存在');
  }

  const startTime = Date.now();

  try {
    // 更新状态为解析中
    await db
      .update(bidDocumentInterpretations)
      .set({
        status: 'parsing',
        parseProgress: 10,
        parseError: null,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, id));

    // 执行LLM解析
    const parseResult = await parseDocumentWithLLM(interpretation.documentUrl, interpretation.documentExt as DocumentExt, customHeaders);

    // 更新进度
    await db
      .update(bidDocumentInterpretations)
      .set({
        parseProgress: 50,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, id));

    // 保存解析结果
    await saveParseResult(id, parseResult);

    // 更新状态为完成
    const duration = Date.now() - startTime;
    await db
      .update(bidDocumentInterpretations)
      .set({
        status: 'completed',
        parseProgress: 100,
        extractAccuracy: 85,
        parseDuration: duration,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, id));

    // 记录日志
    await createInterpretationLog(id, 'parse', `解读完成，耗时 ${duration}ms`, interpretation.uploaderId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '解析失败';
    
    await db
      .update(bidDocumentInterpretations)
      .set({
        status: 'failed',
        parseError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, id));

    // 记录日志
    await createInterpretationLog(id, 'parse_error', `解读失败：${errorMessage}`, interpretation.uploaderId);

    throw error;
  }
}

/**
 * 保存解析结果到数据库
 */
async function saveParseResult(id: number, result: ParseResult): Promise<void> {
  // 更新主表
  await db
    .update(bidDocumentInterpretations)
    .set({
      projectName: result.basicInfo?.projectName as string,
      projectCode: result.basicInfo?.projectCode as string,
      tenderOrganization: result.basicInfo?.tenderOrganization as string,
      tenderAgent: result.basicInfo?.tenderAgent as string,
      projectBudget: result.basicInfo?.projectBudget as string,
      basicInfo: JSON.stringify(result.basicInfo),
      timeNodes: JSON.stringify(result.timeNodes),
      submissionRequirements: JSON.stringify(result.submissionRequirements),
      feeInfo: JSON.stringify(result.feeInfo),
      qualificationRequirements: JSON.stringify(result.qualificationRequirements),
      personnelRequirements: JSON.stringify(result.personnelRequirements),
      docRequirements: JSON.stringify(result.docRequirements),
      otherRequirements: JSON.stringify(result.otherRequirements),
      specCount: result.technicalSpecs?.length || 0,
      scoringCount: result.scoringItems?.length || 0,
      updatedAt: new Date(),
    })
    .where(eq(bidDocumentInterpretations.id, id));

  // 保存技术规格
  if (result.technicalSpecs && result.technicalSpecs.length > 0) {
    for (let i = 0; i < result.technicalSpecs.length; i++) {
      const spec = result.technicalSpecs[i];
      await db.insert(bidTechnicalSpecs).values({
        interpretationId: id,
        specCategory: spec.specCategory,
        specSubCategory: spec.specSubCategory,
        specName: spec.specName,
        specValue: spec.specValue,
        specUnit: spec.specUnit,
        specRequirement: spec.specRequirement,
        minValue: spec.minValue,
        maxValue: spec.maxValue,
        allowableDeviation: spec.allowableDeviation,
        isKeyParam: spec.isKeyParam || false,
        isMandatory: spec.isMandatory !== false,
        originalText: spec.originalText,
        pageNumber: spec.pageNumber,
        sortOrder: i,
      });
    }
  }

  // 保存评分细则
  if (result.scoringItems && result.scoringItems.length > 0) {
    for (let i = 0; i < result.scoringItems.length; i++) {
      const item = result.scoringItems[i];
      await db.insert(bidScoringItems).values({
        interpretationId: id,
        scoringCategory: item.scoringCategory,
        scoringSubCategory: item.scoringSubCategory,
        itemName: item.itemName,
        itemDescription: item.itemDescription,
        serialNumber: item.serialNumber,
        maxScore: item.maxScore,
        minScore: item.minScore || 0,
        scoringMethod: item.scoringMethod,
        scoringCriteria: item.scoringCriteria,
        deductionRules: item.deductionRules ? JSON.stringify(item.deductionRules) : null,
        bonusRules: item.bonusRules ? JSON.stringify(item.bonusRules) : null,
        originalText: item.originalText,
        pageNumber: item.pageNumber,
        sortOrder: i,
      });
    }
  }

  // 保存文档框架
  if (result.documentFramework && result.documentFramework.length > 0) {
    await saveFrameworkItems(id, result.documentFramework);
  }
}

/**
 * 递归保存文档框架
 */
async function saveFrameworkItems(
  interpretationId: number,
  items: FrameworkItem[],
  parentId?: number
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    const result = await db.insert(bidDocumentFramework).values({
      interpretationId,
      chapterNumber: item.chapterNumber,
      chapterTitle: item.chapterTitle,
      chapterType: item.chapterType,
      parentId: parentId || null,
      level: item.level,
      contentRequirement: item.contentRequirement,
      formatRequirement: item.formatRequirement,
      pageLimit: item.pageLimit,
      originalText: item.originalText,
      pageNumber: item.pageNumber,
      sortOrder: i,
    }).returning({ id: bidDocumentFramework.id });

    // 递归保存子章节
    if (item.children && item.children.length > 0) {
      await saveFrameworkItems(interpretationId, item.children, result[0].id);
    }
  }
}

// ============================================
// 技术规格管理
// ============================================

/**
 * 获取技术规格列表
 */
export async function getTechnicalSpecs(interpretationId: number, category?: string) {
  const conditions = [eq(bidTechnicalSpecs.interpretationId, interpretationId)];
  
  if (category) {
    conditions.push(eq(bidTechnicalSpecs.specCategory, category));
  }

  const specs = await db
    .select()
    .from(bidTechnicalSpecs)
    .where(and(...conditions))
    .orderBy(bidTechnicalSpecs.sortOrder);

  return specs;
}

/**
 * 更新技术规格
 */
export async function updateTechnicalSpec(
  id: number,
  data: Partial<{
    specValue: string;
    responseValue: string;
    responseStatus: string;
    remarks: string;
  }>,
  operatorId: number
): Promise<void> {
  await db
    .update(bidTechnicalSpecs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(bidTechnicalSpecs.id, id));

  // 获取解读ID记录日志
  const spec = await db
    .select({ interpretationId: bidTechnicalSpecs.interpretationId })
    .from(bidTechnicalSpecs)
    .where(eq(bidTechnicalSpecs.id, id))
    .limit(1);

  if (spec[0]) {
    await createInterpretationLog(spec[0].interpretationId, 'update_spec', '更新技术规格响应', operatorId);
  }
}

// ============================================
// 评分细则管理
// ============================================

/**
 * 获取评分细则列表
 */
export async function getScoringItems(interpretationId: number, category?: string) {
  const conditions = [eq(bidScoringItems.interpretationId, interpretationId)];
  
  if (category) {
    conditions.push(eq(bidScoringItems.scoringCategory, category));
  }

  const items = await db
    .select()
    .from(bidScoringItems)
    .where(and(...conditions))
    .orderBy(bidScoringItems.sortOrder);

  return items.map(item => ({
    ...item,
    deductionRules: item.deductionRules ? JSON.parse(item.deductionRules) : null,
    bonusRules: item.bonusRules ? JSON.parse(item.bonusRules) : null,
  }));
}

/**
 * 更新评分细则
 */
export async function updateScoringItem(
  id: number,
  data: Partial<{
    selfScore: number;
    responseContent: string;
    responseStatus: string;
    remarks: string;
  }>,
  operatorId: number
): Promise<void> {
  await db
    .update(bidScoringItems)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(bidScoringItems.id, id));

  // 获取解读ID记录日志
  const item = await db
    .select({ interpretationId: bidScoringItems.interpretationId })
    .from(bidScoringItems)
    .where(eq(bidScoringItems.id, id))
    .limit(1);

  if (item[0]) {
    await createInterpretationLog(item[0].interpretationId, 'update_scoring', '更新评分项响应', operatorId);
  }
}

// ============================================
// 核对清单管理
// ============================================

/**
 * 获取核对清单
 */
export async function getChecklist(interpretationId: number, category?: string) {
  const conditions = [eq(bidRequirementChecklist.interpretationId, interpretationId)];
  
  if (category) {
    conditions.push(eq(bidRequirementChecklist.checklistCategory, category));
  }

  const items = await db
    .select()
    .from(bidRequirementChecklist)
    .where(and(...conditions))
    .orderBy(bidRequirementChecklist.sortOrder);

  return items.map(item => ({
    ...item,
    requiredDocuments: item.requiredDocuments ? JSON.parse(item.requiredDocuments) : null,
    proofDocuments: item.proofDocuments ? JSON.parse(item.proofDocuments) : null,
  }));
}

/**
 * 创建核对清单项
 */
export async function createChecklistItem(
  interpretationId: number,
  data: {
    checklistCategory: string;
    checklistSubCategory?: string;
    itemName: string;
    itemDescription?: string;
    requirementDetail?: string;
    isMandatory?: boolean;
    originalText?: string;
    pageNumber?: number;
  },
  operatorId: number
): Promise<number> {
  const result = await db
    .insert(bidRequirementChecklist)
    .values({
      interpretationId,
      ...data,
      isMandatory: data.isMandatory !== false,
    })
    .returning({ id: bidRequirementChecklist.id });

  await createInterpretationLog(interpretationId, 'create_checklist', '添加核对项', operatorId);

  return result[0].id;
}

/**
 * 更新核对清单项
 */
export async function updateChecklistItem(
  id: number,
  data: Partial<{
    checkStatus: string;
    actualValue: string;
    proofDocuments: string;
    improvementSuggestion: string;
    remarks: string;
  }>,
  operatorId: number
): Promise<void> {
  await db
    .update(bidRequirementChecklist)
    .set({
      ...data,
      checkedBy: operatorId,
      checkedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bidRequirementChecklist.id, id));

  // 获取解读ID记录日志
  const item = await db
    .select({ interpretationId: bidRequirementChecklist.interpretationId })
    .from(bidRequirementChecklist)
    .where(eq(bidRequirementChecklist.id, id))
    .limit(1);

  if (item[0]) {
    await createInterpretationLog(item[0].interpretationId, 'update_checklist', '更新核对项状态', operatorId);
  }
}

// ============================================
// 文档框架管理
// ============================================

/**
 * 获取文档框架（树形结构）
 */
export async function getDocumentFramework(interpretationId: number) {
  const items = await db
    .select()
    .from(bidDocumentFramework)
    .where(eq(bidDocumentFramework.interpretationId, interpretationId))
    .orderBy(bidDocumentFramework.sortOrder);

  // 构建树形结构
  const buildTree = (parentId: number | null = null): FrameworkItem[] => {
    return items
      .filter(item => (parentId === null ? item.parentId === null : item.parentId === parentId))
      .map(item => ({
        id: item.id,
        chapterNumber: item.chapterNumber || undefined,
        chapterTitle: item.chapterTitle,
        chapterType: item.chapterType || undefined,
        level: item.level,
        contentRequirement: item.contentRequirement || undefined,
        formatRequirement: item.formatRequirement || undefined,
        pageLimit: item.pageLimit || undefined,
        originalText: item.originalText || undefined,
        pageNumber: item.pageNumber || undefined,
        relatedScoringIds: item.relatedScoringIds ? JSON.parse(item.relatedScoringIds) : undefined,
        children: buildTree(item.id),
      }));
  };

  return buildTree(null);
}

// ============================================
// 时间提醒管理
// ============================================

/**
 * 获取时间提醒列表
 */
export async function getTimeReminders(interpretationId: number) {
  const reminders = await db
    .select()
    .from(bidTimeReminders)
    .where(eq(bidTimeReminders.interpretationId, interpretationId))
    .orderBy(bidTimeReminders.targetTime);

  return reminders;
}

/**
 * 创建时间提醒
 */
export async function createTimeReminder(
  interpretationId: number,
  data: {
    reminderType: string;
    targetTime: Date;
    reminderDays?: number;
    reminderMethod?: string;
    reminderContent: string;
    userId: number;
  },
  operatorId: number
): Promise<number> {
  const reminderTime = new Date(data.targetTime);
  reminderTime.setDate(reminderTime.getDate() - (data.reminderDays || 3));

  const result = await db
    .insert(bidTimeReminders)
    .values({
      interpretationId,
      reminderType: data.reminderType,
      reminderTime,
      targetTime: data.targetTime,
      reminderDays: data.reminderDays || 3,
      reminderMethod: data.reminderMethod || 'system',
      reminderContent: data.reminderContent,
      userId: data.userId,
    })
    .returning({ id: bidTimeReminders.id });

  await createInterpretationLog(interpretationId, 'create_reminder', '创建时间提醒', operatorId);

  return result[0].id;
}

/**
 * 删除时间提醒
 */
export async function deleteTimeReminder(id: number, operatorId: number): Promise<void> {
  const reminder = await db
    .select({ interpretationId: bidTimeReminders.interpretationId })
    .from(bidTimeReminders)
    .where(eq(bidTimeReminders.id, id))
    .limit(1);

  await db.delete(bidTimeReminders).where(eq(bidTimeReminders.id, id));

  if (reminder[0]) {
    await createInterpretationLog(reminder[0].interpretationId, 'delete_reminder', '删除时间提醒', operatorId);
  }
}

// ============================================
// 日志管理
// ============================================

/**
 * 创建解读日志
 */
async function createInterpretationLog(
  interpretationId: number,
  operationType: string,
  operationContent: string,
  operatorId?: number,
  operationIp?: string
): Promise<void> {
  await db.insert(bidInterpretationLogs).values({
    interpretationId,
    operationType,
    operationContent,
    operatorId: operatorId || null,
    operationIp: operationIp || null,
  });
}

/**
 * 获取解读日志
 */
export async function getInterpretationLogs(interpretationId: number) {
  const logs = await db
    .select()
    .from(bidInterpretationLogs)
    .where(eq(bidInterpretationLogs.interpretationId, interpretationId))
    .orderBy(desc(bidInterpretationLogs.operationTime));

  return logs;
}

// ============================================
// 统计分析
// ============================================

/**
 * 获取解读统计
 */
export async function getInterpretationStats(uploaderId?: number) {
  const conditions = uploaderId ? [eq(bidDocumentInterpretations.uploaderId, uploaderId)] : [];

  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${bidDocumentInterpretations.status} = 'pending')`,
      parsing: sql<number>`count(*) filter (where ${bidDocumentInterpretations.status} = 'parsing')`,
      completed: sql<number>`count(*) filter (where ${bidDocumentInterpretations.status} = 'completed')`,
      failed: sql<number>`count(*) filter (where ${bidDocumentInterpretations.status} = 'failed')`,
    })
    .from(bidDocumentInterpretations)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return stats[0];
}

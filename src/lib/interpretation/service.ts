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
  users,
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
  reviewStatus?: 'pending' | 'approved' | 'rejected' | 'none';
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
  evidence?: Record<string, unknown>;
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
    .select({
      interpretation: bidDocumentInterpretations,
      reviewerName: users.realName,
    })
    .from(bidDocumentInterpretations)
    .leftJoin(users, eq(bidDocumentInterpretations.reviewerId, users.id))
    .where(eq(bidDocumentInterpretations.id, id))
    .limit(1);

  if (!interpretation[0]) {
    return null;
  }

  // 获取分配的审核人名称
  const assignedReviewer = interpretation[0].interpretation.assignedReviewerId
    ? await db
        .select({ name: users.realName })
        .from(users)
        .where(eq(users.id, interpretation[0].interpretation.assignedReviewerId))
        .limit(1)
    : null;

  const item = interpretation[0].interpretation;

  // 解析JSON字段
  return {
    ...item,
    reviewerName: interpretation[0].reviewerName,
    assignedReviewerName: assignedReviewer?.[0]?.name || null,
    basicInfo: item.basicInfo ? JSON.parse(item.basicInfo) : null,
    timeNodes: item.timeNodes ? JSON.parse(item.timeNodes) : null,
    submissionRequirements: item.submissionRequirements ? JSON.parse(item.submissionRequirements) : null,
    feeInfo: item.feeInfo ? JSON.parse(item.feeInfo) : null,
    qualificationRequirements: item.qualificationRequirements ? JSON.parse(item.qualificationRequirements) : null,
    personnelRequirements: item.personnelRequirements ? JSON.parse(item.personnelRequirements) : null,
    docRequirements: item.docRequirements ? JSON.parse(item.docRequirements) : null,
    otherRequirements: item.otherRequirements ? JSON.parse(item.otherRequirements) : null,
    extractMeta: item.extractMeta ? JSON.parse(item.extractMeta) : null,
    tags: item.tags ? JSON.parse(item.tags) : [],
  };
}

/**
 * 获取解读记录列表
 */
export async function getInterpretationList(params: InterpretationListParams = {}) {
  const { status, reviewStatus, keyword, uploaderId, projectId, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (status) {
    conditions.push(eq(bidDocumentInterpretations.status, status));
  }

  if (reviewStatus) {
    if (reviewStatus === 'none') {
      conditions.push(sql`(${bidDocumentInterpretations.reviewStatus} IS NULL OR ${bidDocumentInterpretations.reviewStatus} = 'pending')`);
    } else {
      conditions.push(eq(bidDocumentInterpretations.reviewStatus, reviewStatus));
    }
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
    .select({
      interpretation: bidDocumentInterpretations,
      reviewerName: users.realName,
    })
    .from(bidDocumentInterpretations)
    .leftJoin(users, eq(bidDocumentInterpretations.reviewerId, users.id))
    .where(whereClause)
    .orderBy(desc(bidDocumentInterpretations.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    list: list.map(item => ({
      ...item.interpretation,
      reviewerName: item.reviewerName,
      tags: item.interpretation.tags ? JSON.parse(item.interpretation.tags) : [],
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

function computeExtractAccuracy(meta: unknown): number | null {
  if (!meta || typeof meta !== 'object') return null;
  const scores: number[] = [];

  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === 'object') {
      const confidence = (node as any).confidence;
      if (typeof confidence === 'number' && Number.isFinite(confidence)) {
        const normalized = Math.max(0, Math.min(1, confidence));
        scores.push(normalized);
      }
      for (const value of Object.values(node)) visit(value);
    }
  };

  visit(meta);
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 100);
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
    throw new Error(
      `文档解析失败：无法提取文本内容（${documentExt}）。建议优先上传 .docx/.pdf；若为 .doc 请在服务器安装 libreoffice（soffice）或 wvText/catdoc 以启用文本提取。`
    );
  }

  const maxChars = process.env.LLM_INPUT_MAX_CHARS ? Number(process.env.LLM_INPUT_MAX_CHARS) : 40000;
  const tailChars = process.env.LLM_INPUT_TAIL_CHARS ? Number(process.env.LLM_INPUT_TAIL_CHARS) : 6000;
  const headChars = Math.max(0, maxChars - tailChars);
  const contentForLLM =
    textContent.length > maxChars
      ? `${textContent.slice(0, headChars)}\n\n[...内容过长已截断...]\n\n${textContent.slice(-tailChars)}`
      : textContent;

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
    "tenderScope": "招标范围",
    "tenderNumber": "招标编号/公告号",
    "tenderCategory": "采购类别",
    "announcementType": "公告类型",
    "deliveryAddress": " Delivery地址/文件获取地点"
  },
  "timeNodes": [
    {
      "name": "时间节点名称",
      "time": "具体时间",
      "location": "地点（如适用）"
    }
  ],
  "submissionRequirements": [
    {
      "requirementType": "要求类型（如：投标方式、密封要求、截止时间等）",
      "requirement": "具体要求描述",
      "copies": "份数要求"
    }
  ],
  "feeInfo": {
    "documentFee": "招标文件购买费用",
    "documentFeeDeadline": "缴纳截止时间",
    "documentFeePaymentMethod": "缴费方式",
    "bidBond": "投标保证金金额",
    "bidBondMethod": "缴纳方式（电汇/转账/保函等）",
    "bidBondDeadline": "保证金缴纳截止时间",
    "bidBondRefundCondition": "退还条件",
    "performanceBond": "履约保证金金额",
    "performanceBondRatio": "履约保证金比例"
  },
  "qualificationRequirements": [
    {
      "type": "资质类型",
      "requirement": "具体要求",
      "isRequired": true/false,
      "certRequired": "需要提供的证明材料"
    }
  ],
  "personnelRequirements": [
    {
      "position": "岗位",
      "count": "人数要求",
      "qualification": "资质要求",
      "experience": "经验要求",
      "certificate": "需要的证书"
    }
  ],
  "technicalSpecs": [
    {
      "specCategory": "规格分类（如：服务器/软件/网络/服务等）",
      "specSubCategory": "子分类（可选）",
      "specName": "参数名称",
      "specValue": "要求值",
      "specUnit": "单位",
      "specRequirement": "要求描述",
      "minValue": "最小值（可选）",
      "maxValue": "最大值（可选）",
      "isKeyParam": true/false,
      "isMandatory": true/false,
      "allowableDeviation": "允许偏差"
    }
  ],
  "scoringItems": [
    {
      "scoringCategory": "评分分类（商务/技术/报价）",
      "scoringSubCategory": "子分类（可选）",
      "itemName": "评分项名称",
      "itemDescription": "评分项说明",
      "serialNumber": "序号",
      "maxScore": "最高分值",
      "minScore": "最低分值",
      "scoringMethod": "评分方法",
      "scoringCriteria": "评分标准/评分细则"
    }
  ],
  "docRequirements": [
    {
      "docType": "文档类型",
      "copies": "份数",
      "requirement": "格式/内容要求",
      "binding": "装订要求"
    }
  ],
  "otherRequirements": {
    "consortiumRequirement": "联合体要求",
    "performanceRequirement": "业绩要求",
    "afterSalesRequirement": "售后服务要求",
    "paymentMethod": "付款方式",
    "contractPeriod": "合同期限",
    "warrantyPeriod": "质保期",
    "trainingRequirement": "培训要求",
    "specialRequirement": "特殊要求"
  },
  "documentFramework": [
    {
      "chapterNumber": "章节编号（如：第一章）",
      "chapterTitle": "章节标题",
      "chapterType": "章节类型（正文/附录/附件等）",
      "level": 1,
      "contentRequirement": "内容要求",
      "pageLimit": "页数限制",
      "formatRequirement": "格式要求"
    }
  ]
}

请仔细阅读文档，提取所有关键信息。注意：
1. 时间节点要精确到具体日期和时间
2. 资格条件要区分必须满足的和可选的
3. 评分项要标注分值和评分方法
4. 技术参数要注明是否为关键参数
5. 对不确定的内容，请标注"待确认"
6. 费用相关字段要尽量详细，包括金额、支付方式、截止时间等
7. 投标文件要求要包含份数、装订方式、密封要求等
8. 在输出中增加 evidence 字段，用于记录每个关键字段的置信度与证据引用：
   - confidence: 0~1 的数值
   - quote: 从原文中摘取的一小段原句（尽量精确、可核对）
   - evidence 示例： 
   {
     "basicInfo": {
       "projectName": { "confidence": 0.9, "quote": "项目名称：xxx" }
     }
   }`;

  const parseJson = (content: string) => {
    const fenced = content.match(/```json\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1] || content;
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  };

  const parseJsonArray = (content: string) => {
    const fenced = content.match(/```json\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1] || content;
    const jsonMatch = candidate.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  };

  const extractTechnicalSpecsWithLLM = async (fullText: string) => {
    const chunkChars = process.env.LLM_SPECS_CHUNK_CHARS ? Number(process.env.LLM_SPECS_CHUNK_CHARS) : 12000;
    const maxChunks = process.env.LLM_SPECS_MAX_CHUNKS ? Number(process.env.LLM_SPECS_MAX_CHUNKS) : 8;
    const maxItemsPerChunk = process.env.LLM_SPECS_MAX_ITEMS_PER_CHUNK
      ? Number(process.env.LLM_SPECS_MAX_ITEMS_PER_CHUNK)
      : 50;

    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += chunkChars) {
      chunks.push(fullText.slice(i, i + chunkChars));
      if (chunks.length >= maxChunks) break;
    }

    const all: TechnicalSpecItem[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const messages = [
        {
          role: 'system' as const,
          content:
            `你是一个严格的“技术参数/规格”抽取器。\n` +
            `只输出 JSON 数组，不要输出任何解释。\n` +
            `数组元素结构：{\n` +
            `  "specCategory": "规格分类（例如：服务器/软件/网络/性能/安全/服务/资质/其他）",\n` +
            `  "specSubCategory": "子分类（可选）",\n` +
            `  "specName": "参数名称",\n` +
            `  "specValue": "要求值（可选）",\n` +
            `  "specUnit": "单位（可选）",\n` +
            `  "specRequirement": "要求描述（可选）",\n` +
            `  "isKeyParam": true/false,\n` +
            `  "isMandatory": true/false,\n` +
            `  "originalText": "原文摘录（尽量精确）",\n` +
            `  "pageNumber": 1\n` +
            `}\n` +
            `要求：\n` +
            `- 只抽取文档中“技术参数/规格/配置/性能指标/验收指标”等可核对项\n` +
            `- 尽量完整，最多输出 ${maxItemsPerChunk} 条\n` +
            `- 不要编造，不确定就写在 specRequirement 里并保留原文\n` +
            `- 如果本段没有技术规格，输出 []`,
        },
        {
          role: 'user' as const,
          content: `这是第 ${i + 1}/${chunks.length} 段文本：\n\n${chunk}`,
        },
      ];

      const response = await generateWithDefaultLLM(messages as any, { temperature: 0.2 });
      const parsed = parseJsonArray(response.content);
      if (Array.isArray(parsed)) {
        all.push(...(parsed as any));
        continue;
      }

      const repairMessages = [
        {
          role: 'system' as const,
          content: '你是一个严格的 JSON 修复器。只输出一个合法的 JSON 数组，不要输出任何多余字符。',
        },
        {
          role: 'user' as const,
          content:
            '把下面内容转换成一个合法 JSON 数组（补齐缺失引号/逗号/括号，去掉解释文字）。只输出 JSON：\n\n' +
            response.content,
        },
      ];
      const repaired = await generateWithDefaultLLM(repairMessages as any, { temperature: 0 });
      const repairedParsed = parseJsonArray(repaired.content);
      if (Array.isArray(repairedParsed)) {
        all.push(...(repairedParsed as any));
      }
    }

    const dedup = new Map<string, TechnicalSpecItem>();
    for (const item of all) {
      if (!item || typeof item !== 'object') continue;
      const specCategory = String((item as any).specCategory || '').trim();
      const specName = String((item as any).specName || '').trim();
      if (!specCategory || !specName) continue;
      const specValue = String((item as any).specValue || '').trim();
      const specRequirement = String((item as any).specRequirement || '').trim();
      const key = `${specCategory.toLowerCase()}|${specName.toLowerCase()}|${specValue.toLowerCase()}|${specRequirement.toLowerCase()}`;
      if (!dedup.has(key)) dedup.set(key, item as any);
    }

    return Array.from(dedup.values());
  };

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content:
        `请解析以下招标文件内容。\n` +
        `要求：只输出一个 JSON 对象，不要输出任何解释、前后缀、Markdown；如果必须用代码块，请用 \`\`\`json 包裹。\n\n` +
        contentForLLM,
    },
  ];

  try {
    const response = await generateWithDefaultLLM(messages as any);

    const parsed = parseJson(response.content);
    if (parsed) {
      const enableSecondPass = process.env.INTERPRETATION_ENABLE_SPECS_SECOND_PASS !== 'false';
      if (enableSecondPass) {
        const detailedSpecs = await extractTechnicalSpecsWithLLM(textContent);
        const currentSpecs = Array.isArray((parsed as any).technicalSpecs) ? (parsed as any).technicalSpecs : [];
        if (detailedSpecs.length > currentSpecs.length) {
          (parsed as any).technicalSpecs = detailedSpecs;
        }
      }
      return parsed as ParseResult;
    }

    const repairMessages = [
      {
        role: 'system' as const,
        content:
          '你是一个严格的 JSON 修复器。只输出一个合法的 JSON 对象，不要输出任何多余字符。',
      },
      {
        role: 'user' as const,
        content:
          '把下面内容转换成一个合法 JSON 对象（保留字段结构，补齐缺失引号/逗号/括号，去掉解释文字）。只输出 JSON：\n\n' +
          response.content,
      },
    ];
    const repaired = await generateWithDefaultLLM(repairMessages as any, { temperature: 0 });
    const repairedParsed = parseJson(repaired.content);
    if (repairedParsed) {
      const enableSecondPass = process.env.INTERPRETATION_ENABLE_SPECS_SECOND_PASS !== 'false';
      if (enableSecondPass) {
        const detailedSpecs = await extractTechnicalSpecsWithLLM(textContent);
        const currentSpecs = Array.isArray((repairedParsed as any).technicalSpecs) ? (repairedParsed as any).technicalSpecs : [];
        if (detailedSpecs.length > currentSpecs.length) {
          (repairedParsed as any).technicalSpecs = detailedSpecs;
        }
      }
      return repairedParsed as ParseResult;
    }

    throw new Error(`无法解析LLM响应: ${(response.content || '').slice(0, 300)}`);
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
  const fallbackAccuracy = process.env.INTERPRETATION_EXTRACT_ACCURACY
    ? Number(process.env.INTERPRETATION_EXTRACT_ACCURACY)
    : 85;

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
    const parseResult = await parseDocumentWithLLM(
      interpretation.documentUrl,
      interpretation.documentExt as DocumentExt,
      customHeaders
    );
    const computedAccuracy = computeExtractAccuracy((parseResult as any).evidence);

    // 更新进度
    await db
      .update(bidDocumentInterpretations)
      .set({
        parseProgress: 50,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, id));

    // 保存解析结果
    await saveParseResult(id, parseResult, (parseResult as any).evidence);

    // 更新状态为完成
    const duration = Date.now() - startTime;
    const accuracy = computedAccuracy ?? fallbackAccuracy;
    
    // 自动审核规则：准确率 >= 95% 自动通过
    const autoApproveThreshold = 95;
    let reviewStatus: 'pending' | 'approved' = 'pending';
    
    if (accuracy >= autoApproveThreshold) {
      reviewStatus = 'approved';
    }
    
    await db
      .update(bidDocumentInterpretations)
      .set({
        status: 'completed',
        parseProgress: 100,
        extractAccuracy: accuracy,
        parseDuration: duration,
        reviewStatus,
        approvalLevelRequired: accuracy >= autoApproveThreshold ? 1 : 1,
        currentApprovalLevel: accuracy >= autoApproveThreshold ? 1 : 1,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, id));

    // 记录日志
    const logMsg = accuracy >= autoApproveThreshold 
      ? `解读完成，耗时 ${duration}ms，准确率${accuracy}%（自动通过）`
      : `解读完成，耗时 ${duration}ms，准确率${accuracy}%`;
    await createInterpretationLog(id, 'parse', logMsg, interpretation.uploaderId);

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
async function saveParseResult(id: number, result: ParseResult, extractMeta?: unknown): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
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
        extractMeta: extractMeta ? JSON.stringify(extractMeta) : null,
        updatedAt: new Date(),
      })
      .where(eq(bidDocumentInterpretations.id, id));

    await tx.delete(bidTechnicalSpecs).where(eq(bidTechnicalSpecs.interpretationId, id));
    await tx.delete(bidScoringItems).where(eq(bidScoringItems.interpretationId, id));
    await tx.delete(bidRequirementChecklist).where(eq(bidRequirementChecklist.interpretationId, id));
    await tx.delete(bidDocumentFramework).where(eq(bidDocumentFramework.interpretationId, id));

    if (result.technicalSpecs && result.technicalSpecs.length > 0) {
      for (let i = 0; i < result.technicalSpecs.length; i++) {
        const spec = result.technicalSpecs[i];
        await tx.insert(bidTechnicalSpecs).values({
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

    if (result.scoringItems && result.scoringItems.length > 0) {
      for (let i = 0; i < result.scoringItems.length; i++) {
        const item = result.scoringItems[i];
        await tx.insert(bidScoringItems).values({
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

    if (result.documentFramework && result.documentFramework.length > 0) {
      await saveFrameworkItemsTx(tx as any, id, result.documentFramework);
    }
  });
}

/**
 * 递归保存文档框架
 */
async function saveFrameworkItemsTx(
  tx: any,
  interpretationId: number,
  items: FrameworkItem[],
  parentId?: number
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    const result = await tx.insert(bidDocumentFramework).values({
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
      await saveFrameworkItemsTx(tx, interpretationId, item.children, result[0].id);
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
      reviewPending: sql<number>`count(*) filter (where ${bidDocumentInterpretations.status} = 'completed' and (${bidDocumentInterpretations.reviewStatus} IS NULL OR ${bidDocumentInterpretations.reviewStatus} = 'pending'))`,
      reviewApproved: sql<number>`count(*) filter (where ${bidDocumentInterpretations.reviewStatus} = 'approved')`,
      reviewRejected: sql<number>`count(*) filter (where ${bidDocumentInterpretations.reviewStatus} = 'rejected')`,
    })
    .from(bidDocumentInterpretations)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return stats[0];
}

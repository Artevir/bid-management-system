import fs from 'fs/promises';
import path from 'path';
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  attachmentRequirementNodes,
  bidFrameworkNodes,
  clarificationCandidates,
  commercialRequirements,
  confidenceAssessments,
  conflictItems,
  documentPages,
  documentSectionNodes,
  frameworkRequirementBindings,
  hubBidTemplates,
  moneyTerms,
  objectChangeLogs,
  qualificationRequirements,
  responseTaskItems,
  reviewTasks,
  riskItems,
  ruleHitRecords,
  scoringItems,
  scoringSchemes,
  sourceDocuments,
  sourceSegments,
  submissionMaterials,
  submissionRequirements,
  technicalRequirements,
  technicalSpecGroups,
  technicalSpecItems,
  formTableStructures,
  templateBlocks,
  templateVariableBindings,
  templateVariables,
  tenderProjects,
  tenderRequirements,
  timeNodes,
} from '@/db/schema';
import { evaluateBestMatchingHubRule } from '@/lib/tender-center/evaluate-rules';

const MAX_PAGES_PER_DOCUMENT = 500;
const MAX_REQUIREMENTS_PER_DOCUMENT = 200;

type IngestOptions = {
  projectId: number;
  versionId: number;
  batchId: number;
};

export type IngestResult = {
  parsedDocuments: number;
  failedDocuments: number;
  pagesInserted: number;
  segmentsInserted: number;
  requirementsInserted: number;
  risksInserted: number;
  sectionNodesInserted: number;
  specializedRequirementRowsInserted: number;
  timeNodesInserted: number;
  moneyTermsInserted: number;
  confidenceRowsInserted: number;
  changeLogRowsInserted: number;
  frameworkNodesInserted: number;
  frameworkBindingsInserted: number;
  ruleHitsInserted: number;
  attachmentNodesInserted: number;
  scoringItemsInserted: number;
  technicalSpecItemsInserted: number;
  hubTemplatesInserted: number;
  submissionMaterialsInserted: number;
  responseTasksInserted: number;
  reviewTasksInserted: number;
  clarificationCandidatesInserted: number;
  conflictItemsInserted: number;
};

function normalizeStorageKey(storageKey: string): string {
  const value = storageKey.trim();
  if (!value) return '';
  if (value.startsWith('/uploads/')) return value.slice(1);
  return value;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function resolveStorageBuffer(storageKey: string): Promise<Buffer> {
  const key = normalizeStorageKey(storageKey);
  if (!key) {
    throw new Error('storageKey 为空，无法执行解析');
  }

  if (isHttpUrl(key)) {
    const res = await fetch(key);
    if (!res.ok) {
      throw new Error(`下载源文件失败: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) {
      throw new Error('下载源文件为空');
    }
    return buf;
  }

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const candidate = path.resolve(process.cwd(), key);
  const safePrefix = uploadsRoot + path.sep;
  if (!candidate.startsWith(safePrefix) && candidate !== uploadsRoot) {
    throw new Error('storageKey 非法：仅允许 uploads 目录下文件');
  }

  return fs.readFile(candidate);
}

function decodeUtf8(buffer: Buffer): string {
  return new TextDecoder('utf-8').decode(buffer);
}

function splitTextToPages(text: string, maxChars = 2400): string[] {
  const compact = text.replace(/\r\n/g, '\n').trim();
  if (!compact) return [];
  const rawPages = compact
    .split(/\f+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (rawPages.length > 1) {
    return rawPages.slice(0, MAX_PAGES_PER_DOCUMENT);
  }

  const lines = compact.split('\n');
  const pages: string[] = [];
  let current = '';
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxChars && current) {
      pages.push(current.trim());
      current = line;
    } else {
      current = next;
    }
  }
  if (current.trim()) pages.push(current.trim());
  return pages.slice(0, MAX_PAGES_PER_DOCUMENT);
}

function splitPageToSegments(pageText: string): string[] {
  const chunks = pageText
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (chunks.length > 0) {
    return chunks.slice(0, 80);
  }
  return pageText
    .split(/\n/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function classifyRequirementType(
  text: string
): 'qualification' | 'commercial' | 'technical' | 'time' | 'money' | 'submission' | 'other' {
  if (/(资格|资质|证书|业绩|人员)/.test(text)) return 'qualification';
  if (/(开标|截止|时点|时间|日期|递交截止|报名)/.test(text)) return 'time';
  if (/(预算|限价|控制价|保证金|金额|报价|价款|费用|人民币)/.test(text)) return 'money';
  if (/(报价|商务|付款|保证金|保函|税费|价格)/.test(text)) return 'commercial';
  if (/(技术|参数|性能|规格|标准|方案)/.test(text)) return 'technical';
  if (/(递交|提交|开标|截止|时间|日期|地点)/.test(text)) return 'submission';
  return 'other';
}

function classifyImportanceLevel(text: string): 'low' | 'medium' | 'high' | 'critical' {
  if (/(必须|严禁|不得|否决|废标|无效)/.test(text)) return 'critical';
  if (/(应当|需|要求|须|需要)/.test(text)) return 'high';
  if (/(建议|宜)/.test(text)) return 'low';
  return 'medium';
}

function classifyRiskType(
  text: string
):
  | 'bid_rejection_risk'
  | 'invalid_bid_risk'
  | 'qualification_risk'
  | 'timeline_risk'
  | 'amount_risk'
  | 'template_risk'
  | 'framework_risk'
  | 'technical_deviation_risk'
  | 'other_risk' {
  if (/(废标|否决|不予受理|无效标)/.test(text)) return 'bid_rejection_risk';
  if (/(无效|不合规|违法|违规|不满足)/.test(text)) return 'invalid_bid_risk';
  if (/(资质|资格|证书|人员|业绩)/.test(text)) return 'qualification_risk';
  if (/(延期|逾期|工期|时间|节点|截止)/.test(text)) return 'timeline_risk';
  if (/(报价|付款|保证金|成本|税|金额|预算|限价)/.test(text)) return 'amount_risk';
  if (/(模板|格式|表单)/.test(text)) return 'template_risk';
  if (/(章节|框架|目录|结构)/.test(text)) return 'framework_risk';
  if (/(参数|技术|性能|偏离)/.test(text)) return 'technical_deviation_risk';
  return 'other_risk';
}

function riskLevelFromImportance(
  importance: 'low' | 'medium' | 'high' | 'critical'
): 'low' | 'medium' | 'high' | 'critical' {
  if (importance === 'critical') return 'critical';
  if (importance === 'high') return 'high';
  if (importance === 'low') return 'low';
  return 'medium';
}

function shouldRaiseRisk(
  text: string,
  importance: 'low' | 'medium' | 'high' | 'critical'
): boolean {
  if (importance === 'critical' || importance === 'high') return true;
  return /(风险|罚|违约|扣分|不予受理|无效标)/.test(text);
}

function inferQualificationType(
  text: string
):
  | 'enterprise_qualification'
  | 'personnel_qualification'
  | 'project_experience'
  | 'financial_requirement'
  | 'credit_requirement'
  | 'social_security_requirement'
  | 'certification_requirement'
  | 'other_qualification' {
  if (/(业绩|合同|类似项目)/.test(text)) return 'project_experience';
  if (/(财务|审计|资金|纳税)/.test(text)) return 'financial_requirement';
  if (/(信用|失信|征信)/.test(text)) return 'credit_requirement';
  if (/(社保|公积金)/.test(text)) return 'social_security_requirement';
  if (/(证书|资质认定|认证)/.test(text)) return 'certification_requirement';
  if (/(项目经理|人员|工程师|建造师)/.test(text)) return 'personnel_qualification';
  if (/(企业|法人|营业执照|公司)/.test(text)) return 'enterprise_qualification';
  return 'other_qualification';
}

function inferCommercialType(
  text: string
):
  | 'bid_bond'
  | 'performance_bond'
  | 'document_fee'
  | 'payment_terms'
  | 'delivery_period'
  | 'warranty_period'
  | 'after_sales_commitment'
  | 'service_response'
  | 'penalty_clause'
  | 'other_commercial' {
  if (/(履约保证金|履约保函)/.test(text)) return 'performance_bond';
  if (/(保证金|保函)/.test(text)) return 'bid_bond';
  if (/(标书费|招标文件费|文件费)/.test(text)) return 'document_fee';
  if (/(付款|支付|结算|发票)/.test(text)) return 'payment_terms';
  if (/(交付|工期|供货周期|期限)/.test(text)) return 'delivery_period';
  if (/(质保|保修)/.test(text)) return 'warranty_period';
  if (/(售后|维保|服务响应)/.test(text)) return 'service_response';
  if (/(承诺|承诺函)/.test(text)) return 'after_sales_commitment';
  if (/(罚则|违约|处罚)/.test(text)) return 'penalty_clause';
  return 'other_commercial';
}

function inferTechnicalType(
  text: string
):
  | 'functional_requirement'
  | 'performance_requirement'
  | 'parameter_requirement'
  | 'compatibility_requirement'
  | 'deployment_requirement'
  | 'security_requirement'
  | 'interface_requirement'
  | 'training_requirement'
  | 'other_technical' {
  if (/(功能|用途|业务能力)/.test(text)) return 'functional_requirement';
  if (/(性能|吞吐|响应|并发)/.test(text)) return 'performance_requirement';
  if (/(参数|指标)/.test(text)) return 'parameter_requirement';
  if (/(兼容|适配|互通)/.test(text)) return 'compatibility_requirement';
  if (/(部署|安装|上线)/.test(text)) return 'deployment_requirement';
  if (/(安全|加密|权限|审计)/.test(text)) return 'security_requirement';
  if (/(接口|协议|对接)/.test(text)) return 'interface_requirement';
  if (/(培训|交底|指导)/.test(text)) return 'training_requirement';
  return 'other_technical';
}

function inferTimeNodeType(
  text: string
):
  | 'document_obtain_deadline'
  | 'question_deadline'
  | 'answer_release_time'
  | 'site_visit_time'
  | 'bid_submission_deadline'
  | 'bid_opening_time'
  | 'bond_deadline'
  | 'other_time_node' {
  if (/(开标|唱标)/.test(text)) return 'bid_opening_time';
  if (/(递交|提交|投标截止|截止)/.test(text)) return 'bid_submission_deadline';
  if (/(答疑|答复|澄清发布时间)/.test(text)) return 'answer_release_time';
  if (/(提问|疑问|质疑截止)/.test(text)) return 'question_deadline';
  if (/(踏勘|现场|勘察)/.test(text)) return 'site_visit_time';
  if (/(获取|领取|下载招标文件)/.test(text)) return 'document_obtain_deadline';
  if (/(保证金截止|保函截止)/.test(text)) return 'bond_deadline';
  return 'other_time_node';
}

function inferMoneyType(
  text: string
):
  | 'project_budget'
  | 'max_price'
  | 'document_fee'
  | 'bid_bond'
  | 'performance_bond'
  | 'penalty_amount'
  | 'other_money' {
  if (/(预算)/.test(text)) return 'project_budget';
  if (/(最高限价|控制价)/.test(text)) return 'max_price';
  if (/(标书费|招标文件费|文件费)/.test(text)) return 'document_fee';
  if (/(履约保证金|履约保函)/.test(text)) return 'performance_bond';
  if (/(保证金|保函)/.test(text)) return 'bid_bond';
  if (/(罚款|违约金|处罚金额)/.test(text)) return 'penalty_amount';
  return 'other_money';
}

function looksLikeTimeClause(text: string): boolean {
  return (
    /(截止|开标|递交|提交|时间|日期|时点)/.test(text) &&
    /(\d{4}\s*年|\d{1,2}\s*月|\d{1,2}\s*日|\d{1,2}:\d{2}|T\d{2}:\d{2})/.test(text)
  );
}

function looksLikeMoneyClause(text: string): boolean {
  return (
    /\d/.test(text) &&
    /(元|万|人民币|%)/.test(text) &&
    /(保证金|预算|价款|价|费|金额|报价)/.test(text)
  );
}

type HubQualRequirementInsert = {
  tenderRequirementId: number;
  qualificationType: ReturnType<typeof inferQualificationType>;
  proofMaterialHint: string;
  hardConstraintFlag: boolean;
};
type HubCommRequirementInsert = {
  tenderRequirementId: number;
  commercialType: ReturnType<typeof inferCommercialType>;
  proofMaterialHint: string;
};
type HubTechRequirementInsert = {
  tenderRequirementId: number;
  technicalType: ReturnType<typeof inferTechnicalType>;
  requirementValue: string;
  hardConstraintFlag: boolean;
};
type HubSubmissionRequirementInsert = {
  tenderProjectVersionId: number;
  submissionType: 'other_submission';
  requirementText: string;
  sourceSegmentId: number;
};
type HubTimeNodeInsert = {
  tenderProjectVersionId: number;
  nodeType: ReturnType<typeof inferTimeNodeType>;
  nodeName: string;
  timeText: string;
  sourceSegmentId: number;
  confidenceScore: string;
  reviewStatus: 'draft';
};
type HubMoneyTermInsert = {
  tenderProjectVersionId: number;
  moneyType: ReturnType<typeof inferMoneyType>;
  amountText: string;
  sourceSegmentId: number;
  reviewStatus: 'draft';
};

async function extractPages(
  buffer: Buffer,
  ext: string,
  mimeType: string | null
): Promise<string[]> {
  const normalizedExt = ext.toLowerCase();
  if (normalizedExt === 'pdf' || mimeType === 'application/pdf') {
    const pdfParseMod = await import('pdf-parse');
    const parser = (pdfParseMod.default ?? pdfParseMod) as (
      data: Buffer
    ) => Promise<{ text: string }>;
    const data = await parser(buffer);
    return splitTextToPages(data.text);
  }

  if (
    normalizedExt === 'docx' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = await import('mammoth');
    const data = await mammoth.extractRawText({ buffer });
    return splitTextToPages(data.value);
  }

  if (
    normalizedExt === 'xlsx' ||
    normalizedExt === 'xls' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    const xlsx = await import('xlsx');
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const sheetTexts = wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name];
      return `# ${name}\n${xlsx.utils.sheet_to_csv(sheet)}`;
    });
    return splitTextToPages(sheetTexts.join('\n\n'));
  }

  if (
    normalizedExt === 'txt' ||
    normalizedExt === 'md' ||
    normalizedExt === 'csv' ||
    normalizedExt === 'json'
  ) {
    return splitTextToPages(decodeUtf8(buffer));
  }

  return splitTextToPages(decodeUtf8(buffer));
}

export async function ingestTenderVersionDocuments(options: IngestOptions): Promise<IngestResult> {
  const { projectId, versionId, batchId } = options;
  let parsedDocuments = 0;
  let failedDocuments = 0;
  let pagesInserted = 0;
  let segmentsInserted = 0;
  let requirementsInserted = 0;
  let risksInserted = 0;
  let sectionNodesInserted = 0;
  let specializedRequirementRowsInserted = 0;
  let timeNodesInserted = 0;
  let moneyTermsInserted = 0;
  let confidenceRowsInserted = 0;
  let changeLogRowsInserted = 0;
  let frameworkNodesInserted = 0;
  let frameworkBindingsInserted = 0;
  let ruleHitsInserted = 0;
  let attachmentNodesInserted = 0;
  let scoringItemsInserted = 0;
  let technicalSpecItemsInserted = 0;
  let hubTemplatesInserted = 0;
  let submissionMaterialsInserted = 0;
  let responseTasksInserted = 0;
  let reviewTasksInserted = 0;
  let clarificationCandidatesInserted = 0;
  let conflictItemsInserted = 0;

  const docs = await db
    .select({
      id: sourceDocuments.id,
      fileExt: sourceDocuments.fileExt,
      mimeType: sourceDocuments.mimeType,
      storageKey: sourceDocuments.storageKey,
      fileName: sourceDocuments.fileName,
    })
    .from(sourceDocuments)
    .where(
      and(
        eq(sourceDocuments.tenderProjectVersionId, versionId),
        eq(sourceDocuments.isDeleted, false)
      )
    );

  for (let docIdx = 0; docIdx < docs.length; docIdx += 1) {
    const doc = docs[docIdx];
    const key = doc.storageKey || '';
    try {
      const exists = await db
        .select({ id: documentPages.id })
        .from(documentPages)
        .where(and(eq(documentPages.sourceDocumentId, doc.id), eq(documentPages.isDeleted, false)))
        .limit(1);
      if (exists.length > 0) {
        continue;
      }

      const buffer = await resolveStorageBuffer(key);
      const pages = await extractPages(buffer, doc.fileExt ?? '', doc.mimeType);
      if (pages.length === 0) {
        throw new Error('文本抽取为空');
      }

      const insertedPages = await db
        .insert(documentPages)
        .values(
          pages.map((page, i) => ({
            sourceDocumentId: doc.id,
            pageNo: i + 1,
            pageText: page,
          }))
        )
        .returning({
          id: documentPages.id,
          pageNo: documentPages.pageNo,
          pageText: documentPages.pageText,
        });
      pagesInserted += insertedPages.length;

      const segmentValues: Array<{
        sourceDocumentId: number;
        documentPageId: number;
        segmentType: 'paragraph';
        rawText: string;
        normalizedText: string;
        orderNo: number;
      }> = [];
      for (const page of insertedPages) {
        const texts = splitPageToSegments(page.pageText || '');
        if (texts.length === 0) continue;
        for (let i = 0; i < texts.length; i += 1) {
          const text = texts[i];
          segmentValues.push({
            sourceDocumentId: doc.id,
            documentPageId: page.id,
            segmentType: 'paragraph',
            rawText: text,
            normalizedText: text.replace(/\s+/g, ' ').trim(),
            orderNo: i + 1,
          });
        }
      }

      const insertedSegments =
        segmentValues.length > 0
          ? await db.insert(sourceSegments).values(segmentValues).returning({
              id: sourceSegments.id,
              documentPageId: sourceSegments.documentPageId,
              rawText: sourceSegments.rawText,
            })
          : [];
      segmentsInserted += insertedSegments.length;

      const pageNoMap = new Map<number, number>();
      for (const page of insertedPages) {
        pageNoMap.set(page.id, page.pageNo);
      }

      const rootSectionRows = await db
        .insert(documentSectionNodes)
        .values({
          tenderProjectVersionId: versionId,
          parentId: null,
          sectionTitle: doc.fileName?.trim() || `源文件-${doc.id}`,
          nodeType: 'volume',
          orderNo: docIdx,
          startPageNo: 1,
          endPageNo: insertedPages.length,
          pathText: `/version/${versionId}/doc/${doc.id}`,
        })
        .returning({ id: documentSectionNodes.id });
      const rootSectionId = rootSectionRows[0]?.id;
      if (!rootSectionId) {
        throw new Error('document_section_node 根节点写入失败');
      }

      const clauseSourceSegments = insertedSegments.slice(0, 60);
      const clauseRows = clauseSourceSegments.map((seg, idx) => ({
        tenderProjectVersionId: versionId,
        parentId: rootSectionId,
        sectionTitle: (seg.rawText || '').split('\n')[0]?.slice(0, 120) || `段落-${idx + 1}`,
        nodeType: 'clause' as const,
        headingLevel: 4,
        orderNo: idx + 1,
        sourceSegmentId: seg.id,
        startPageNo: seg.documentPageId
          ? (pageNoMap.get(seg.documentPageId) ?? undefined)
          : undefined,
        endPageNo: seg.documentPageId
          ? (pageNoMap.get(seg.documentPageId) ?? undefined)
          : undefined,
      }));

      const insertedClauses =
        clauseRows.length > 0
          ? await db.insert(documentSectionNodes).values(clauseRows).returning({
              id: documentSectionNodes.id,
              sourceSegmentId: documentSectionNodes.sourceSegmentId,
            })
          : [];

      sectionNodesInserted += 1 + insertedClauses.length;

      const segmentToSectionId = new Map<number, number>();
      for (const row of insertedClauses) {
        if (row.sourceSegmentId) {
          segmentToSectionId.set(row.sourceSegmentId, row.id);
        }
      }

      const segById = new Map(insertedSegments.map((s) => [s.id, s]));

      const [fwRootRow] = await db
        .insert(bidFrameworkNodes)
        .values({
          tenderProjectVersionId: versionId,
          parentId: null,
          frameworkTitle: `投标响应框架·${doc.fileName?.trim() || `源文件-${doc.id}`}`,
          levelNo: 0,
          orderNo: docIdx,
          sourceSectionId: rootSectionId,
          generationMode: 'semi_auto',
          contentType: 'text',
          reviewStatus: 'draft',
        })
        .returning({ id: bidFrameworkNodes.id });
      const fwRootId = fwRootRow?.id;
      if (!fwRootId) {
        throw new Error('bid_framework_node 根节点写入失败');
      }

      const fwChildValues = insertedClauses.map((row, idx) => {
        const text =
          (row.sourceSegmentId ? segById.get(row.sourceSegmentId)?.rawText : undefined) || '';
        return {
          tenderProjectVersionId: versionId,
          parentId: fwRootId,
          frameworkTitle: text.split('\n')[0]?.slice(0, 120) || `响应章节-${idx + 1}`,
          levelNo: 1,
          orderNo: idx + 1,
          sourceSectionId: row.id,
          sourceSegmentId: row.sourceSegmentId,
          generationMode: 'semi_auto' as const,
          contentType: 'text' as const,
          reviewStatus: 'draft' as const,
        };
      });

      const fwChildren =
        fwChildValues.length > 0
          ? await db.insert(bidFrameworkNodes).values(fwChildValues).returning({
              id: bidFrameworkNodes.id,
              sourceSectionId: bidFrameworkNodes.sourceSectionId,
            })
          : [];

      frameworkNodesInserted += 1 + fwChildren.length;

      const sectionIdToFwNodeId = new Map<number, number>();
      for (const f of fwChildren) {
        if (f.sourceSectionId) {
          sectionIdToFwNodeId.set(f.sourceSectionId, f.id);
        }
      }

      const requirementValues = insertedSegments
        .slice(0, MAX_REQUIREMENTS_PER_DOCUMENT)
        .filter((seg) => {
          const text = seg.rawText || '';
          return text.length >= 8 && /(要求|应|须|不得|应当|必须|提供|提交)/.test(text);
        })
        .map((seg, idx) => {
          const text = seg.rawText || '';
          const requirementType = classifyRequirementType(text);
          const importanceLevel = classifyImportanceLevel(text);
          const riskLevel = riskLevelFromImportance(importanceLevel);
          return {
            tenderProjectVersionId: versionId,
            requirementCode: `REQ-${versionId}-${doc.id}-${idx + 1}`,
            requirementType,
            requirementSubtype: null,
            title: text.slice(0, 60),
            content: text,
            normalizedContent: text.replace(/\s+/g, ' ').trim(),
            sourceSectionId: segmentToSectionId.get(seg.id) ?? null,
            sourceSegmentId: seg.id,
            sourcePageNo: seg.documentPageId ? (pageNoMap.get(seg.documentPageId) ?? null) : null,
            importanceLevel,
            riskLevel,
            confidenceScore: '0.7000',
            extractedByBatchId: batchId,
            reviewStatus: 'draft' as const,
          };
        });

      const insertedRequirements =
        requirementValues.length > 0
          ? await db.insert(tenderRequirements).values(requirementValues).returning({
              id: tenderRequirements.id,
              requirementType: tenderRequirements.requirementType,
              content: tenderRequirements.content,
              importanceLevel: tenderRequirements.importanceLevel,
              sourceSegmentId: tenderRequirements.sourceSegmentId,
              sourceSectionId: tenderRequirements.sourceSectionId,
            })
          : [];
      requirementsInserted += insertedRequirements.length;

      const bindRows = insertedRequirements
        .map((r) => {
          if (!r.sourceSectionId) return null;
          const fwN = sectionIdToFwNodeId.get(r.sourceSectionId);
          if (!fwN) return null;
          return {
            bidFrameworkNodeId: fwN,
            tenderRequirementId: r.id,
            bindingType: 'inferred' as const,
            note: '解析启发式绑定',
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (bindRows.length > 0) {
        await db.insert(frameworkRequirementBindings).values(bindRows);
      }
      frameworkBindingsInserted += bindRows.length;

      const qualRows: HubQualRequirementInsert[] = [];
      const commRows: HubCommRequirementInsert[] = [];
      const techRows: HubTechRequirementInsert[] = [];
      const subRows: HubSubmissionRequirementInsert[] = [];
      const timeRows: HubTimeNodeInsert[] = [];
      const moneyRows: HubMoneyTermInsert[] = [];
      const timeDedup = new Set<number>();
      const moneyDedup = new Set<number>();

      for (const req of insertedRequirements) {
        const text = req.content || '';
        const hard = req.importanceLevel === 'critical';
        switch (req.requirementType) {
          case 'qualification':
            qualRows.push({
              tenderRequirementId: req.id,
              qualificationType: inferQualificationType(text),
              proofMaterialHint: text.slice(0, 200),
              hardConstraintFlag: hard,
            });
            break;
          case 'commercial':
            commRows.push({
              tenderRequirementId: req.id,
              commercialType: inferCommercialType(text),
              proofMaterialHint: text.slice(0, 200),
            });
            break;
          case 'technical':
            techRows.push({
              tenderRequirementId: req.id,
              technicalType: inferTechnicalType(text),
              requirementValue: text.slice(0, 400),
              hardConstraintFlag: hard,
            });
            break;
          case 'submission':
            if (req.sourceSegmentId) {
              subRows.push({
                tenderProjectVersionId: versionId,
                submissionType: 'other_submission',
                requirementText: text.slice(0, 800),
                sourceSegmentId: req.sourceSegmentId,
              });
            }
            break;
          default:
            break;
        }

        const segId = req.sourceSegmentId;
        if (segId && looksLikeTimeClause(text) && !timeDedup.has(segId)) {
          timeDedup.add(segId);
          timeRows.push({
            tenderProjectVersionId: versionId,
            nodeType: inferTimeNodeType(text),
            nodeName: text.slice(0, 80),
            timeText: text.slice(0, 400),
            sourceSegmentId: segId,
            confidenceScore: '0.6200',
            reviewStatus: 'draft',
          });
        }
        if (segId && looksLikeMoneyClause(text) && !moneyDedup.has(segId)) {
          moneyDedup.add(segId);
          moneyRows.push({
            tenderProjectVersionId: versionId,
            moneyType: inferMoneyType(text),
            amountText: text.slice(0, 200),
            sourceSegmentId: segId,
            reviewStatus: 'draft',
          });
        }
      }

      if (qualRows.length > 0) {
        await db.insert(qualificationRequirements).values(qualRows);
      }
      if (commRows.length > 0) {
        await db.insert(commercialRequirements).values(commRows);
      }
      if (techRows.length > 0) {
        await db.insert(technicalRequirements).values(techRows);
      }
      if (subRows.length > 0) {
        await db.insert(submissionRequirements).values(subRows);
      }
      if (timeRows.length > 0) {
        await db.insert(timeNodes).values(timeRows);
      }
      if (moneyRows.length > 0) {
        await db.insert(moneyTerms).values(moneyRows);
      }
      specializedRequirementRowsInserted +=
        qualRows.length + commRows.length + techRows.length + subRows.length;
      timeNodesInserted += timeRows.length;
      moneyTermsInserted += moneyRows.length;

      const riskCandidates = insertedRequirements
        .filter((req) => shouldRaiseRisk(req.content || '', req.importanceLevel))
        .slice(0, 120);

      const riskRuleEvals = await Promise.all(
        riskCandidates.map(async (req) => ({
          req,
          hit: await evaluateBestMatchingHubRule(req.content || ''),
        }))
      );

      const riskValues = riskRuleEvals.map((x, idx) => {
        const riskLevel = riskLevelFromImportance(x.req.importanceLevel);
        return {
          tenderProjectVersionId: versionId,
          relatedRequirementId: x.req.id,
          riskType: classifyRiskType(x.req.content || ''),
          riskTitle: `风险识别 ${idx + 1}`,
          riskDescription: (x.req.content || '').slice(0, 240),
          riskLevel,
          sourceSegmentId: x.req.sourceSegmentId,
          hitRuleId: x.hit?.ruleId ?? null,
          confidenceScore: '0.6500',
          reviewStatus: 'draft' as const,
          resolutionStatus: 'open' as const,
        };
      });

      const insertedRisks =
        riskValues.length > 0
          ? await db.insert(riskItems).values(riskValues).returning({
              id: riskItems.id,
              hitRuleId: riskItems.hitRuleId,
            })
          : [];
      risksInserted += insertedRisks.length;

      const ruleHitRows = insertedRisks
        .map((r, idx) => {
          if (!r.hitRuleId) return null;
          const hit = riskRuleEvals[idx]?.hit;
          return {
            documentParseBatchId: batchId,
            ruleDefinitionId: r.hitRuleId,
            targetObjectType: 'risk_item',
            targetObjectId: r.id,
            hitResult: 'fail' as const,
            hitDetailJson: {
              engine: 'rule_definition_expression_v1',
              ruleCode: hit?.ruleCode ?? null,
            },
            severityLevel: hit?.severityLevel ?? ('medium' as const),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (ruleHitRows.length > 0) {
        await db.insert(ruleHitRecords).values(ruleHitRows);
      }
      ruleHitsInserted += ruleHitRows.length;

      const attachmentSegs = insertedSegments
        .filter((s) => {
          const t = s.rawText || '';
          return (
            t.length >= 6 &&
            /(附件\s*清单|附件\s*\d|投标文件格式|纸质标书|签字盖章|密封要求)/.test(t)
          );
        })
        .slice(0, 24);
      if (attachmentSegs.length > 0) {
        await db.insert(attachmentRequirementNodes).values(
          attachmentSegs.map((s, i) => ({
            tenderProjectVersionId: versionId,
            attachmentName: (s.rawText || '').split('\n')[0]?.slice(0, 120) || `附件要求-${i + 1}`,
            attachmentNo: `ATT-${doc.id}-${i + 1}`,
            attachmentType: 'other' as const,
            requiredType: 'required' as const,
            sourceDocumentId: doc.id,
            sourceSegmentId: s.id,
          }))
        );
      }
      attachmentNodesInserted += attachmentSegs.length;

      const [{ schemeCount }] = await db
        .select({ schemeCount: count() })
        .from(scoringSchemes)
        .where(
          and(
            eq(scoringSchemes.tenderProjectVersionId, versionId),
            eq(scoringSchemes.isDeleted, false)
          )
        );
      if (schemeCount === 0) {
        const scoringSegs = insertedSegments
          .filter((s) => {
            const t = s.rawText || '';
            return (
              t.length >= 10 && /(评分标准|评标办法|分值构成|商务分|技术分|价格分|综合评分)/.test(t)
            );
          })
          .slice(0, 30);
        if (scoringSegs.length > 0) {
          const [scheme] = await db
            .insert(scoringSchemes)
            .values({
              tenderProjectVersionId: versionId,
              schemeName: `评分条款摘录·${doc.fileName ?? doc.id}`,
              reviewStatus: 'draft',
            })
            .returning({ id: scoringSchemes.id });
          if (scheme?.id) {
            await db.insert(scoringItems).values(
              scoringSegs.map((s, i) => ({
                scoringSchemeId: scheme.id,
                itemName: (s.rawText || '').split('\n')[0]?.slice(0, 120) || `评分项-${i + 1}`,
                criteriaText: (s.rawText || '').slice(0, 600),
                orderNo: i + 1,
                sourceSegmentId: s.id,
                reviewStatus: 'draft' as const,
              }))
            );
            scoringItemsInserted += scoringSegs.length;
          }
        }
      }

      const [{ techGroupCount }] = await db
        .select({ techGroupCount: count() })
        .from(technicalSpecGroups)
        .where(
          and(
            eq(technicalSpecGroups.tenderProjectVersionId, versionId),
            eq(technicalSpecGroups.isDeleted, false)
          )
        );
      if (techGroupCount === 0) {
        const specSegs = insertedSegments
          .filter((s) => {
            const t = s.rawText || '';
            return t.length >= 8 && /(技术参数|技术规格|★|星号项|指标要求)/.test(t);
          })
          .slice(0, 40);
        if (specSegs.length > 0) {
          const [group] = await db
            .insert(technicalSpecGroups)
            .values({
              tenderProjectVersionId: versionId,
              groupName: '技术条款摘录',
              groupType: 'mixed',
              orderNo: 0,
            })
            .returning({ id: technicalSpecGroups.id });
          if (group?.id) {
            await db.insert(technicalSpecItems).values(
              specSegs.map((s, i) => ({
                technicalSpecGroupId: group.id,
                specName: `条目-${i + 1}`,
                specRequirement: (s.rawText || '').slice(0, 800),
                sourceSegmentId: s.id,
                reviewStatus: 'draft' as const,
              }))
            );
            technicalSpecItemsInserted += specSegs.length;
          }
        }
      }

      const tplSeg = insertedSegments.find((s) => {
        const t = s.rawText || '';
        return t.length >= 12 && /(响应文件格式|投标函|授权委托书|按所附格式|固定格式)/.test(t);
      });
      if (tplSeg) {
        const [tpl] = await db
          .insert(hubBidTemplates)
          .values({
            tenderProjectVersionId: versionId,
            templateName: `格式模板摘录·${doc.fileName ?? doc.id}`,
            templateType: 'other',
            sourceTitle: (tplSeg.rawText || '').slice(0, 80),
            templateText: (tplSeg.rawText || '').slice(0, 4000),
            sourceSegmentId: tplSeg.id,
            sourcePageNo: tplSeg.documentPageId
              ? (pageNoMap.get(tplSeg.documentPageId) ?? null)
              : null,
            fixedFormatFlag: true,
            reviewStatus: 'draft',
          })
          .returning({ id: hubBidTemplates.id });
        if (tpl?.id) {
          const [block] = await db
            .insert(templateBlocks)
            .values({
              bidTemplateId: tpl.id,
              blockType: 'paragraph',
              orderNo: 1,
              blockText: (tplSeg.rawText || '').slice(0, 2000),
              sourceSegmentId: tplSeg.id,
            })
            .returning({ id: templateBlocks.id });
          const [variable] = await db
            .insert(templateVariables)
            .values({
              bidTemplateId: tpl.id,
              variableName: 'bidder_name',
              variableLabel: '投标人名称',
              variableType: 'text',
              requiredFlag: true,
              sourceBlockId: block?.id ?? null,
              sourceSegmentId: tplSeg.id,
              defaultValueHint: '与营业执照一致',
              reviewStatus: 'draft',
            })
            .returning({ id: templateVariables.id });
          if (variable?.id) {
            await db.insert(templateVariableBindings).values({
              templateVariableId: variable.id,
              bindingTargetType: 'requirement',
              bindingKey: 'tender_requirement.title',
              fallbackStrategy: 'manual',
              note: '占位绑定，后续人工或规则细化',
            });
            await db.insert(formTableStructures).values({
              bidTemplateId: tpl.id,
              tableName: '格式摘录占位表',
              rowNo: 1,
              colNo: 1,
              cellKey: 'bidder_name',
              cellLabel: '投标人名称',
              cellType: 'text',
              requiredFlag: true,
              sourceSegmentId: tplSeg.id,
            });
          }
          hubTemplatesInserted += 1;
        }
      }

      const matRows = insertedRequirements
        .filter((r) => r.requirementType === 'qualification')
        .slice(0, 40)
        .map((r) => ({
          tenderProjectVersionId: versionId,
          materialName: (r.content || '').slice(0, 120) || `资质材料-${r.id}`,
          materialType: 'authorization' as const,
          requiredFlag: true,
          sourceReason: '资格要求启发式生成',
          relatedRequirementId: r.id,
          needSignatureFlag: /(签字|签署)/.test(r.content || ''),
          needSealFlag: /(盖章|公章)/.test(r.content || ''),
          reviewStatus: 'draft' as const,
        }));
      if (matRows.length > 0) {
        await db.insert(submissionMaterials).values(matRows);
      }
      submissionMaterialsInserted += matRows.length;

      for (let i = 0; i < insertedRequirements.length; i += 1) {
        for (let j = i + 1; j < insertedRequirements.length; j += 1) {
          const a = insertedRequirements[i];
          const b = insertedRequirements[j];
          const na = (a.content || '').replace(/\s+/g, '').slice(0, 48);
          const nb = (b.content || '').replace(/\s+/g, '').slice(0, 48);
          if (na.length >= 12 && na === nb) {
            await db.insert(conflictItems).values({
              tenderProjectVersionId: versionId,
              conflictType: 'other',
              fieldName: 'tender_requirement.content',
              candidateA: (a.content || '').slice(0, 400),
              candidateB: (b.content || '').slice(0, 400),
              sourceASegmentId: a.sourceSegmentId,
              sourceBSegmentId: b.sourceSegmentId,
              conflictLevel: 'minor',
              reviewStatus: 'open',
            });
            conflictItemsInserted += 1;
            await db.insert(clarificationCandidates).values({
              tenderProjectVersionId: versionId,
              relatedRequirementId: a.id,
              questionTitle: '疑似重复条款',
              questionContent: '两条要求在正文摘录中完全一致，请确认是否重复或分段表述。',
              questionReason: '启发式冲突检测',
              urgencyLevel: 'normal',
              sourceSegmentId: a.sourceSegmentId,
              reviewStatus: 'draft',
            });
            clarificationCandidatesInserted += 1;
          }
        }
      }

      for (let i = 0; i < insertedRisks.length; i += 1) {
        const rv = riskValues[i];
        const riskRow = insertedRisks[i];
        if (!riskRow || !rv || rv.riskLevel !== 'critical') continue;
        await db.insert(responseTaskItems).values({
          tenderProjectVersionId: versionId,
          taskType: 'internal_review',
          taskTitle: `复核风险 #${riskRow.id}`,
          sourceObjectType: 'risk_item',
          sourceObjectId: riskRow.id,
          priorityLevel: 'p0',
          status: 'pending',
          note: '关键风险项，需人工确认',
        });
        responseTasksInserted += 1;
        await db.insert(reviewTasks).values({
          tenderProjectVersionId: versionId,
          targetObjectType: 'risk_item',
          targetObjectId: riskRow.id,
          reviewReason: 'high_risk',
          reviewStatus: 'pending_assign',
        });
        reviewTasksInserted += 1;
        const req = riskCandidates[i];
        if (req?.sourceSegmentId) {
          await db.insert(clarificationCandidates).values({
            tenderProjectVersionId: versionId,
            relatedRequirementId: req.id,
            questionTitle: '关键条款澄清',
            questionContent: (req.content || '').slice(0, 500),
            questionReason: '高风险条款建议向招标人澄清',
            urgencyLevel: 'urgent',
            sourceSegmentId: req.sourceSegmentId,
            reviewStatus: 'draft',
          });
          clarificationCandidatesInserted += 1;
        }
      }

      const extractionConf = Math.min(
        0.95,
        0.45 + Math.min(insertedSegments.length, 160) * 0.003
      ).toFixed(4);
      await db.insert(confidenceAssessments).values({
        targetObjectType: 'source_document',
        targetObjectId: doc.id,
        extractionConfidence: extractionConf,
        businessConfidence: '0.5500',
        reasonJson: {
          documentParseBatchId: batchId,
          pages: insertedPages.length,
          segments: insertedSegments.length,
          requirements: insertedRequirements.length,
          risks: insertedRisks.length,
          sectionNodes: 1 + insertedClauses.length,
        },
        generatedByBatchId: batchId,
      });
      confidenceRowsInserted += 1;

      await db.insert(objectChangeLogs).values({
        targetObjectType: 'tender_project_version',
        targetObjectId: versionId,
        changeType: 'updated',
        beforeJson: null,
        afterJson: {
          event: 'hub_ingestion_document_parsed',
          sourceDocumentId: doc.id,
          documentParseBatchId: batchId,
          pages: insertedPages.length,
          segments: insertedSegments.length,
          requirements: insertedRequirements.length,
          risks: insertedRisks.length,
          specializedRows: qualRows.length + commRows.length + techRows.length + subRows.length,
          timeNodes: timeRows.length,
          moneyTerms: moneyRows.length,
        },
        operatorId: null,
      });
      changeLogRowsInserted += 1;

      await db
        .update(sourceDocuments)
        .set({
          pageCount: insertedPages.length,
          parseStatus: 'parsed',
          textExtractStatus: 'extracted',
          structureExtractStatus: 'structured',
          updatedAt: new Date(),
        })
        .where(eq(sourceDocuments.id, doc.id));

      parsedDocuments += 1;
    } catch (error) {
      failedDocuments += 1;
      await db
        .update(sourceDocuments)
        .set({
          parseStatus: 'parse_failed',
          textExtractStatus: 'extract_failed',
          structureExtractStatus: 'structure_failed',
          updatedAt: new Date(),
        })
        .where(eq(sourceDocuments.id, doc.id));
      console.error('[tender-center] ingestion failed:', {
        sourceDocumentId: doc.id,
        fileName: doc.fileName,
        storageKey: key,
        error,
      });
    }
  }

  if (failedDocuments > 0 && parsedDocuments === 0) {
    await db
      .update(tenderProjects)
      .set({ parseStatus: 'parse_failed', updatedAt: new Date() })
      .where(eq(tenderProjects.id, projectId));
  } else if (parsedDocuments > 0 && failedDocuments > 0) {
    await db
      .update(tenderProjects)
      .set({ parseStatus: 'partially_parsed', updatedAt: new Date() })
      .where(eq(tenderProjects.id, projectId));
  } else if (parsedDocuments > 0) {
    await db
      .update(tenderProjects)
      .set({ parseStatus: 'parsed', updatedAt: new Date() })
      .where(eq(tenderProjects.id, projectId));
  }

  return {
    parsedDocuments,
    failedDocuments,
    pagesInserted,
    segmentsInserted,
    requirementsInserted,
    risksInserted,
    sectionNodesInserted,
    specializedRequirementRowsInserted,
    timeNodesInserted,
    moneyTermsInserted,
    confidenceRowsInserted,
    changeLogRowsInserted,
    frameworkNodesInserted,
    frameworkBindingsInserted,
    ruleHitsInserted,
    attachmentNodesInserted,
    scoringItemsInserted,
    technicalSpecItemsInserted,
    hubTemplatesInserted,
    submissionMaterialsInserted,
    responseTasksInserted,
    reviewTasksInserted,
    clarificationCandidatesInserted,
    conflictItemsInserted,
  };
}

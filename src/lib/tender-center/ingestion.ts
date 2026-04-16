import fs from 'fs/promises';
import path from 'path';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  commercialRequirements,
  confidenceAssessments,
  documentPages,
  documentSectionNodes,
  moneyTerms,
  objectChangeLogs,
  qualificationRequirements,
  riskItems,
  sourceDocuments,
  sourceSegments,
  submissionRequirements,
  technicalRequirements,
  tenderProjects,
  tenderRequirements,
  timeNodes,
} from '@/db/schema';

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
): 'qualification' | 'commercial' | 'technical' | 'submission' | 'other' {
  if (/(资格|资质|证书|业绩|人员)/.test(text)) return 'qualification';
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
): 'compliance' | 'commercial' | 'technical' | 'legal' | 'schedule' | 'other' {
  if (/(违法|合规|审查|资质)/.test(text)) return 'compliance';
  if (/(报价|付款|保证金|成本|税)/.test(text)) return 'commercial';
  if (/(参数|技术|性能|方案)/.test(text)) return 'technical';
  if (/(合同|违约|责任|索赔)/.test(text)) return 'legal';
  if (/(延期|逾期|工期|时间|节点)/.test(text)) return 'schedule';
  return 'other';
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
): 'enterprise' | 'personnel' | 'performance' | 'financial' | 'certificate' | 'other' {
  if (/(业绩|合同|类似项目)/.test(text)) return 'performance';
  if (/(财务|审计|资金|纳税)/.test(text)) return 'financial';
  if (/(证书|资质认定|认证)/.test(text)) return 'certificate';
  if (/(项目经理|人员|工程师|建造师)/.test(text)) return 'personnel';
  if (/(企业|法人|营业执照|公司)/.test(text)) return 'enterprise';
  return 'other';
}

function inferCommercialType(
  text: string
): 'price' | 'payment' | 'bond' | 'tax' | 'warranty' | 'other' {
  if (/(报价|价格|限价|单价|总价)/.test(text)) return 'price';
  if (/(付款|支付|结算|发票)/.test(text)) return 'payment';
  if (/(保证金|保函)/.test(text)) return 'bond';
  if (/(税|增值税|税率)/.test(text)) return 'tax';
  if (/(质保|保修)/.test(text)) return 'warranty';
  return 'other';
}

function inferTechnicalType(
  text: string
): 'parameter' | 'standard' | 'scope' | 'delivery' | 'service' | 'other' {
  if (/(参数|指标|性能)/.test(text)) return 'parameter';
  if (/(标准|规范|国标|行标)/.test(text)) return 'standard';
  if (/(范围|供货|采购内容)/.test(text)) return 'scope';
  if (/(交付|工期|进度)/.test(text)) return 'delivery';
  if (/(服务|运维|售后)/.test(text)) return 'service';
  return 'other';
}

function inferTimeNodeType(text: string): 'submission' | 'open_bid' | 'register' | 'other' {
  if (/(开标|唱标)/.test(text)) return 'open_bid';
  if (/(递交|提交|截止|报名)/.test(text)) return 'submission';
  if (/(登记|注册)/.test(text)) return 'register';
  return 'other';
}

function inferMoneyType(text: string): 'deposit' | 'budget' | 'tender_fee' | 'payment' | 'other' {
  if (/(保证金|保函)/.test(text)) return 'deposit';
  if (/(预算|最高限价|控制价)/.test(text)) return 'budget';
  if (/(标书费|招标文件费|文件费)/.test(text)) return 'tender_fee';
  if (/(价款|付款|合同价)/.test(text)) return 'payment';
  return 'other';
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
  submissionType: 'document';
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
        .where(eq(documentPages.sourceDocumentId, doc.id))
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
            })
          : [];
      requirementsInserted += insertedRequirements.length;

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
                submissionType: 'document',
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

      const riskValues = insertedRequirements
        .filter((req) => shouldRaiseRisk(req.content || '', req.importanceLevel))
        .slice(0, 120)
        .map((req, idx) => {
          const riskLevel = riskLevelFromImportance(req.importanceLevel);
          return {
            tenderProjectVersionId: versionId,
            relatedRequirementId: req.id,
            riskType: classifyRiskType(req.content || ''),
            riskTitle: `风险识别 ${idx + 1}`,
            riskDescription: (req.content || '').slice(0, 240),
            riskLevel,
            sourceSegmentId: req.sourceSegmentId,
            confidenceScore: '0.6500',
            reviewStatus: 'draft' as const,
            resolutionStatus: 'open' as const,
          };
        });

      if (riskValues.length > 0) {
        await db.insert(riskItems).values(riskValues);
      }
      risksInserted += riskValues.length;

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
          risks: riskValues.length,
          sectionNodes: 1 + insertedClauses.length,
        },
        generatedByBatchId: batchId,
      });
      confidenceRowsInserted += 1;

      await db.insert(objectChangeLogs).values({
        targetObjectType: 'tender_project_version',
        targetObjectId: versionId,
        changeType: 'update',
        beforeJson: null,
        afterJson: {
          event: 'hub_ingestion_document_parsed',
          sourceDocumentId: doc.id,
          documentParseBatchId: batchId,
          pages: insertedPages.length,
          segments: insertedSegments.length,
          requirements: insertedRequirements.length,
          risks: riskValues.length,
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
          textExtractStatus: 'done',
          structureExtractStatus: 'done',
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
          textExtractStatus: 'failed',
          structureExtractStatus: 'failed',
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
  };
}

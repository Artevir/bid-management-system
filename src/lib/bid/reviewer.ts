/**
 * 智能审校服务
 * 提供内容检查、合规检查、格式检查等功能
 */

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import {
  bidDocuments,
  bidChapters,
  documentReviews,
  complianceChecks,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export type ReviewType = 'compliance' | 'format' | 'content' | 'completeness';

export interface ReviewIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  location: {
    chapterId?: number;
    chapterTitle?: string;
    position?: string;
  };
  message: string;
  suggestion?: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ReviewResult {
  score: number;
  passed: boolean;
  issues: ReviewIssue[];
  summary: string;
  statistics: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'critical' | 'major' | 'minor';
  check: (content: string, context: ReviewContext) => Promise<boolean>;
}

export interface ReviewContext {
  documentId: number;
  projectName: string;
  tenderRequirements?: string[];
}

// ============================================
// 智能审校服务
// ============================================

/**
 * 执行文档审校
 */
export async function reviewDocument(
  documentId: number,
  types: ReviewType[],
  customHeaders?: Record<string, string>
): Promise<ReviewResult> {
  // 获取文档信息
  const doc = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  if (doc.length === 0) {
    throw new Error('文档不存在');
  }

  // 获取所有章节
  const chapters = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId));

  const allIssues: ReviewIssue[] = [];

  // 执行各类检查
  for (const type of types) {
    const issues = await executeReviewType(documentId, chapters, type, customHeaders);
    allIssues.push(...issues);
  }

  // 计算分数
  const statistics = {
    total: allIssues.length,
    errors: allIssues.filter((i) => i.type === 'error').length,
    warnings: allIssues.filter((i) => i.type === 'warning').length,
    infos: allIssues.filter((i) => i.type === 'info').length,
  };

  const score = calculateScore(statistics, chapters.length);
  const passed = statistics.errors === 0;

  // 生成摘要
  const summary = await generateReviewSummary(allIssues, customHeaders);

  // 保存审校结果
  await db.insert(documentReviews).values({
    documentId,
    type: 'compliance',
    score,
    result: JSON.stringify({ statistics, summary }),
    issues: JSON.stringify(allIssues),
    status: 'completed',
    reviewedAt: new Date(),
  });

  return {
    score,
    passed,
    issues: allIssues,
    summary,
    statistics,
  };
}

/**
 * 执行特定类型的审校
 */
async function executeReviewType(
  documentId: number,
  chapters: typeof bidChapters.$inferSelect[],
  type: ReviewType,
  customHeaders?: Record<string, string>
): Promise<ReviewIssue[]> {
  switch (type) {
    case 'compliance':
      return reviewCompliance(documentId, chapters, customHeaders);
    case 'format':
      return reviewFormat(documentId, chapters, customHeaders);
    case 'content':
      return reviewContent(documentId, chapters, customHeaders);
    case 'completeness':
      return reviewCompleteness(documentId, chapters, customHeaders);
    default:
      return [];
  }
}

/**
 * 合规检查
 */
async function reviewCompliance(
  documentId: number,
  chapters: typeof bidChapters.$inferSelect[],
  customHeaders?: Record<string, string>
): Promise<ReviewIssue[]> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const issues: ReviewIssue[] = [];

  const systemPrompt = `你是一个标书合规审核专家。请检查内容是否符合招标文件的合规要求。

检查项目：
1. 是否包含法律禁止的内容
2. 是否存在歧视性条款
3. 是否符合招标文件格式要求
4. 是否存在明显的矛盾或错误
5. 关键信息是否准确完整

返回JSON数组格式的问题列表：[{"type":"error|warning|info","message":"问题描述","suggestion":"修改建议","severity":"critical|major|minor"}]`;

  for (const chapter of chapters) {
    if (!chapter.content || chapter.content.length < 50) continue;

    try {
      const response = await client.invoke(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `章节：${chapter.title}\n\n内容：\n${chapter.content.substring(0, 2000)}`,
          },
        ],
        {
          model: 'doubao-seed-1-8-251228',
          temperature: 0.3,
        }
      );

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const chapterIssues = JSON.parse(jsonMatch[0]);
        chapterIssues.forEach((issue: any, index: number) => {
          issues.push({
            id: `compliance-${chapter.id}-${index}`,
            type: issue.type,
            location: {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
            },
            message: issue.message,
            suggestion: issue.suggestion,
            severity: issue.severity,
          });
        });
      }
    } catch (error) {
      console.error(`Review chapter ${chapter.id} error:`, error);
    }
  }

  return issues;
}

/**
 * 格式检查
 */
async function reviewFormat(
  documentId: number,
  chapters: typeof bidChapters.$inferSelect[],
  customHeaders?: Record<string, string>
): Promise<ReviewIssue[]> {
  const issues: ReviewIssue[] = [];

  for (const chapter of chapters) {
    if (!chapter.content) continue;

    // 检查标题格式
    if (!chapter.serialNumber && chapter.level === 1) {
      issues.push({
        id: `format-${chapter.id}-serial`,
        type: 'warning',
        location: { chapterId: chapter.id, chapterTitle: chapter.title },
        message: '一级章节缺少编号',
        suggestion: '添加章节编号以符合标书规范',
        severity: 'minor',
      });
    }

    // 检查内容长度
    if (chapter.content.length < 100 && chapter.isRequired) {
      issues.push({
        id: `format-${chapter.id}-length`,
        type: 'warning',
        location: { chapterId: chapter.id, chapterTitle: chapter.title },
        message: '必填章节内容过短',
        suggestion: '补充章节内容，确保内容完整',
        severity: 'major',
      });
    }

    // 检查段落格式
    const paragraphs = chapter.content.split('\n\n');
    if (paragraphs.length === 1 && chapter.content.length > 500) {
      issues.push({
        id: `format-${chapter.id}-paragraph`,
        type: 'info',
        location: { chapterId: chapter.id, chapterTitle: chapter.title },
        message: '内容缺少分段',
        suggestion: '适当分段以提高可读性',
        severity: 'minor',
      });
    }
  }

  return issues;
}

/**
 * 内容检查
 */
async function reviewContent(
  documentId: number,
  chapters: typeof bidChapters.$inferSelect[],
  customHeaders?: Record<string, string>
): Promise<ReviewIssue[]> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const issues: ReviewIssue[] = [];

  const systemPrompt = `你是一个标书内容审核专家。请检查内容的完整性和专业性。

检查项目：
1. 内容是否完整、有逻辑性
2. 是否存在拼写错误或语法问题
3. 数据和参数是否准确
4. 是否存在空洞、无实际内容的表述
5. 技术方案是否合理可行

返回JSON数组格式的问题列表：[{"type":"error|warning|info","message":"问题描述","suggestion":"修改建议","severity":"critical|major|minor"}]`;

  for (const chapter of chapters) {
    if (!chapter.content || chapter.content.length < 100) continue;

    try {
      const response = await client.invoke(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `章节：${chapter.title}\n\n内容：\n${chapter.content.substring(0, 3000)}`,
          },
        ],
        {
          model: 'doubao-seed-1-8-251228',
          temperature: 0.3,
        }
      );

      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const chapterIssues = JSON.parse(jsonMatch[0]);
        chapterIssues.forEach((issue: any, index: number) => {
          issues.push({
            id: `content-${chapter.id}-${index}`,
            type: issue.type,
            location: {
              chapterId: chapter.id,
              chapterTitle: chapter.title,
            },
            message: issue.message,
            suggestion: issue.suggestion,
            severity: issue.severity,
          });
        });
      }
    } catch (error) {
      console.error(`Content review chapter ${chapter.id} error:`, error);
    }
  }

  return issues;
}

/**
 * 完整性检查
 */
async function reviewCompleteness(
  documentId: number,
  chapters: typeof bidChapters.$inferSelect[],
  customHeaders?: Record<string, string>
): Promise<ReviewIssue[]> {
  const issues: ReviewIssue[] = [];

  // 检查必填章节
  const requiredChapters = chapters.filter((c) => c.isRequired);
  const incompleteRequired = requiredChapters.filter(
    (c) => !c.isCompleted || !c.content || c.content.length < 50
  );

  incompleteRequired.forEach((chapter) => {
    issues.push({
      id: `complete-${chapter.id}`,
      type: 'error',
      location: { chapterId: chapter.id, chapterTitle: chapter.title },
      message: '必填章节未完成',
      suggestion: '请完成此必填章节的内容',
      severity: 'critical',
    });
  });

  // 检查章节结构
  const rootChapters = chapters.filter((c) => !c.parentId);
  if (rootChapters.length === 0) {
    issues.push({
      id: 'complete-structure',
      type: 'error',
      location: {},
      message: '文档缺少章节结构',
      suggestion: '请添加标书章节',
      severity: 'critical',
    });
  }

  // 检查常见必要章节
  const requiredTypes: Array<'cover' | 'toc' | 'business' | 'technical'> = ['cover', 'toc', 'business', 'technical'];
  const existingTypes = rootChapters.map((c) => c.type);

  requiredTypes.forEach((type) => {
    if (!existingTypes.includes(type as any)) {
      issues.push({
        id: `complete-missing-${type}`,
        type: 'warning',
        location: {},
        message: `缺少${type === 'cover' ? '封面' : type === 'toc' ? '目录' : type === 'business' ? '商务部分' : '技术部分'}章节`,
        suggestion: '建议添加此章节以符合标书规范',
        severity: 'major',
      });
    }
  });

  return issues;
}

/**
 * 计算审校分数
 */
function calculateScore(
  statistics: { total: number; errors: number; warnings: number; infos: number },
  chapterCount: number
): number {
  const baseScore = 100;
  const errorPenalty = 10;
  const warningPenalty = 3;
  const infoPenalty = 1;

  const penalty =
    statistics.errors * errorPenalty +
    statistics.warnings * warningPenalty +
    statistics.infos * infoPenalty;

  return Math.max(0, baseScore - penalty);
}

/**
 * 生成审校摘要
 */
async function generateReviewSummary(
  issues: ReviewIssue[],
  customHeaders?: Record<string, string>
): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const errorSummary = issues
    .filter((i) => i.type === 'error')
    .map((i) => `- ${i.location.chapterTitle || '整体'}: ${i.message}`)
    .join('\n');

  const warningSummary = issues
    .filter((i) => i.type === 'warning')
    .map((i) => `- ${i.location.chapterTitle || '整体'}: ${i.message}`)
    .join('\n');

  const prompt = `请根据以下审校问题生成一个简洁的摘要（200字以内）：

错误问题：
${errorSummary || '无'}

警告问题：
${warningSummary || '无'}

请总结主要问题和改进建议：`;

  try {
    const response = await client.invoke(
      [{ role: 'user', content: prompt }],
      {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.3,
      }
    );

    return response.content;
  } catch (error) {
    console.error('Generate summary error:', error);
    return `发现 ${issues.length} 个问题，其中 ${issues.filter((i) => i.type === 'error').length} 个错误需要修复。`;
  }
}

/**
 * 保存合规检查结果
 */
export async function saveComplianceCheck(params: {
  documentId: number;
  chapterId?: number;
  ruleId: string;
  ruleName: string;
  description: string;
  result: 'pass' | 'fail' | 'warning';
  severity: string;
  location?: string;
  suggestion?: string;
}): Promise<void> {
  await db.insert(complianceChecks).values({
    documentId: params.documentId,
    chapterId: params.chapterId || null,
    ruleId: params.ruleId,
    ruleName: params.ruleName,
    description: params.description,
    result: params.result,
    severity: params.severity,
    location: params.location || null,
    suggestion: params.suggestion || null,
    isResolved: false,
  });
}

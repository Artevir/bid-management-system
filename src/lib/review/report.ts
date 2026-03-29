/**
 * 审校报告服务
 * 提供审校报告生成、管理、导出功能
 */

import { db } from '@/db';
import { bidDocuments, bidChapters, reviewReports, documentReviews, complianceChecks as _complianceChecks } from '@/db/schema';
import { eq, desc, and as _and } from 'drizzle-orm';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

// ============================================
// 类型定义
// ============================================

export type ReportType = 'compliance' | 'format' | 'content' | 'complete' | 'full';

export interface ReportIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  location: {
    chapterId?: number;
    chapterTitle?: string;
    position?: string;
  };
  message: string;
  suggestion?: string;
  severity: 'critical' | 'major' | 'minor';
  status: 'open' | 'fixed' | 'ignored';
}

export interface ReportStatistics {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byCategory: Record<string, number>;
  byChapter: Array<{ chapterId: number; chapterTitle: string; count: number }>;
  bySeverity: { critical: number; major: number; minor: number };
}

export interface ReportRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  impact: string;
}

export interface GenerateReportOptions {
  documentId: number;
  type: ReportType;
  title?: string;
  reviewScope?: {
    chapterIds?: number[];
    includeCompliance?: boolean;
    includeFormat?: boolean;
    includeContent?: boolean;
    includeCompleteness?: boolean;
  };
  customHeaders?: Record<string, string>;
}

export interface ExportReportOptions {
  reportId: number;
  format: 'html' | 'markdown' | 'pdf';
  includeDetails?: boolean;
  includeRecommendations?: boolean;
}

// ============================================
// 报告生成服务
// ============================================

/**
 * 生成审校报告
 */
export async function generateReport(
  options: GenerateReportOptions,
  userId: number
): Promise<typeof reviewReports.$inferSelect> {
  const { documentId, type, title, reviewScope, customHeaders } = options;

  // 获取文档信息
  const doc = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  if (doc.length === 0) {
    throw new Error('文档不存在');
  }

  const document = doc[0];

  // 获取章节
  const chapters = await db
    .select()
    .from(bidChapters)
    .where(eq(bidChapters.documentId, documentId));

  // 筛选章节
  let targetChapters = chapters;
  if (reviewScope?.chapterIds?.length) {
    targetChapters = chapters.filter((c) => reviewScope.chapterIds!.includes(c.id));
  }

  // 收集审校结果
  const allIssues: ReportIssue[] = [];
  const startTime = new Date();

  // 获取已有的审校结果
  const existingReviews = await db
    .select()
    .from(documentReviews)
    .where(eq(documentReviews.documentId, documentId));

  // 合并已有问题
  for (const review of existingReviews) {
    if (review.issues) {
      try {
        const issues = JSON.parse(review.issues);
        issues.forEach((issue: any) => {
          allIssues.push({
            ...issue,
            category: issue.category || review.type,
            status: 'open',
          });
        });
      } catch (e) {
        console.error('Parse review issues error:', e);
      }
    }
  }

  // 如果需要，执行新的审校
  const shouldReview = type === 'full' || allIssues.length === 0;
  if (shouldReview) {
    const { reviewDocument } = await import('../bid/reviewer');
    
    const reviewTypes: Array<'compliance' | 'format' | 'content' | 'completeness'> = [];
    if (type === 'full' || type === 'compliance') reviewTypes.push('compliance');
    if (type === 'full' || type === 'format') reviewTypes.push('format');
    if (type === 'full' || type === 'content') reviewTypes.push('content');
    if (type === 'full' || type === 'complete') reviewTypes.push('completeness');

    const result = await reviewDocument(documentId, reviewTypes, customHeaders);
    
    result.issues.forEach((issue) => {
      allIssues.push({
        ...issue,
        category: determineCategory(issue),
        status: 'open',
      });
    });
  }

  const endTime = new Date();

  // 生成统计数据
  const statistics = generateStatistics(allIssues, targetChapters);

  // 生成报告摘要
  const summary = await generateReportSummary(document, allIssues, statistics, customHeaders);

  // 生成改进建议
  const recommendations = await generateRecommendations(allIssues, statistics, customHeaders);

  // 生成报告编号
  const reportNo = await generateReportNo(documentId, type);

  // 保存报告
  const [report] = await db
    .insert(reviewReports)
    .values({
      documentId,
      reportNo,
      title: title || `${document.name} - 审校报告`,
      type,
      score: calculateOverallScore(statistics),
      status: 'draft',
      summary,
      issues: JSON.stringify(allIssues),
      statistics: JSON.stringify(statistics),
      recommendations: JSON.stringify(recommendations),
      reviewScope: reviewScope ? JSON.stringify(reviewScope) : null,
      reviewStartTime: startTime,
      reviewEndTime: endTime,
      createdBy: userId,
    })
    .returning();

  return report;
}

/**
 * 确定问题类别
 */
function determineCategory(issue: any): string {
  if (issue.id?.startsWith('compliance')) return '合规检查';
  if (issue.id?.startsWith('format')) return '格式检查';
  if (issue.id?.startsWith('content')) return '内容检查';
  if (issue.id?.startsWith('complete')) return '完整性检查';
  return '其他';
}

/**
 * 生成统计数据
 */
function generateStatistics(
  issues: ReportIssue[],
  _chapters: typeof bidChapters.$inferSelect[]
): ReportStatistics {
  const byCategory: Record<string, number> = {};
  const byChapterMap = new Map<number, { chapterTitle: string; count: number }>();

  issues.forEach((issue) => {
    // 按类别统计
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;

    // 按章节统计
    if (issue.location.chapterId) {
      const existing = byChapterMap.get(issue.location.chapterId);
      if (existing) {
        existing.count++;
      } else {
        byChapterMap.set(issue.location.chapterId, {
          chapterTitle: issue.location.chapterTitle || '未知章节',
          count: 1,
        });
      }
    }
  });

  const byChapter = Array.from(byChapterMap.entries()).map(([chapterId, data]) => ({
    chapterId,
    chapterTitle: data.chapterTitle,
    count: data.count,
  }));

  const bySeverity = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    major: issues.filter((i) => i.severity === 'major').length,
    minor: issues.filter((i) => i.severity === 'minor').length,
  };

  return {
    total: issues.length,
    errors: issues.filter((i) => i.type === 'error').length,
    warnings: issues.filter((i) => i.type === 'warning').length,
    infos: issues.filter((i) => i.type === 'info').length,
    byCategory,
    byChapter,
    bySeverity,
  };
}

/**
 * 计算综合评分
 */
function calculateOverallScore(statistics: ReportStatistics): number {
  const baseScore = 100;
  const errorPenalty = 10;
  const warningPenalty = 3;
  const infoPenalty = 1;
  const criticalBonus = 5;

  const penalty =
    statistics.errors * errorPenalty +
    statistics.warnings * warningPenalty +
    statistics.infos * infoPenalty;

  // 严重问题额外扣分
  const criticalPenalty = statistics.bySeverity.critical * criticalBonus;

  return Math.max(0, baseScore - penalty - criticalPenalty);
}

/**
 * 生成报告摘要
 */
async function generateReportSummary(
  document: typeof bidDocuments.$inferSelect,
  issues: ReportIssue[],
  statistics: ReportStatistics,
  customHeaders?: Record<string, string>
): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const errorIssues = issues.filter((i) => i.type === 'error');
  const warningIssues = issues.filter((i) => i.type === 'warning');

  const prompt = `请根据以下审校结果生成一份简洁的报告摘要（200字以内）：

文档：${document.name}
总问题数：${statistics.total}
错误：${statistics.errors}，警告：${statistics.warnings}，提示：${statistics.infos}
严重问题：${statistics.bySeverity.critical}，主要问题：${statistics.bySeverity.major}，次要问题：${statistics.bySeverity.minor}

主要错误：
${errorIssues.slice(0, 5).map((i) => `- ${i.location.chapterTitle || '整体'}: ${i.message}`).join('\n')}

主要警告：
${warningIssues.slice(0, 5).map((i) => `- ${i.location.chapterTitle || '整体'}: ${i.message}`).join('\n')}

请生成摘要：`;

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
    return `本文档审校共发现 ${statistics.total} 个问题，其中错误 ${statistics.errors} 个、警告 ${statistics.warnings} 个、提示 ${statistics.infos} 个。建议优先处理 ${statistics.bySeverity.critical} 个严重问题和 ${statistics.bySeverity.major} 个主要问题。`;
  }
}

/**
 * 生成改进建议
 */
async function generateRecommendations(
  issues: ReportIssue[],
  statistics: ReportStatistics,
  _customHeaders?: Record<string, string>
): Promise<ReportRecommendation[]> {
  const recommendations: ReportRecommendation[] = [];

  // 基于问题类型生成建议
  if (statistics.byCategory['合规检查'] > 0) {
    recommendations.push({
      priority: 'high',
      category: '合规检查',
      title: '完善合规性内容',
      description: `发现 ${statistics.byCategory['合规检查']} 个合规相关问题，请检查是否满足招标文件的资质要求和技术规范。`,
      impact: '避免因合规问题导致废标',
    });
  }

  if (statistics.byCategory['完整性检查'] > 0) {
    recommendations.push({
      priority: 'high',
      category: '完整性检查',
      title: '补充缺失内容',
      description: `发现 ${statistics.byCategory['完整性检查']} 个完整性问题，请确保所有必填章节内容完整。`,
      impact: '确保标书内容完整，避免遗漏',
    });
  }

  if (statistics.byCategory['格式检查'] > 0) {
    recommendations.push({
      priority: 'medium',
      category: '格式检查',
      title: '规范文档格式',
      description: `发现 ${statistics.byCategory['格式检查']} 个格式问题，建议统一文档格式。`,
      impact: '提升标书专业形象',
    });
  }

  if (statistics.byCategory['内容检查'] > 0) {
    recommendations.push({
      priority: 'medium',
      category: '内容检查',
      title: '优化内容质量',
      description: `发现 ${statistics.byCategory['内容检查']} 个内容问题，请检查内容的准确性和专业性。`,
      impact: '提高标书竞争力',
    });
  }

  // AI生成额外建议
  if (statistics.bySeverity.critical > 0) {
    recommendations.unshift({
      priority: 'high',
      category: '紧急处理',
      title: '处理严重问题',
      description: `发现 ${statistics.bySeverity.critical} 个严重问题，请立即处理。这些问题可能导致标书被废标或严重影响评分。`,
      impact: '避免废标风险',
    });
  }

  return recommendations;
}

/**
 * 生成报告编号
 */
async function generateReportNo(documentId: number, type: ReportType): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // 查询当日已有报告数
  const reports = await db
    .select()
    .from(reviewReports)
    .where(eq(reviewReports.documentId, documentId));

  const todayReports = reports.filter((r) => {
    const created = new Date(r.createdAt);
    return (
      created.getFullYear() === year &&
      created.getMonth() + 1 === parseInt(month) &&
      created.getDate() === parseInt(day)
    );
  });

  const seq = String(todayReports.length + 1).padStart(3, '0');
  const typeCode = type === 'full' ? 'ALL' : type.substring(0, 3).toUpperCase();

  return `RPT-${year}${month}${day}-${documentId}-${typeCode}-${seq}`;
}

// ============================================
// 报告管理服务
// ============================================

/**
 * 获取报告列表
 */
export async function getReports(documentId: number) {
  return db
    .select()
    .from(reviewReports)
    .where(eq(reviewReports.documentId, documentId))
    .orderBy(desc(reviewReports.createdAt));
}

/**
 * 获取报告详情
 */
export async function getReport(reportId: number) {
  const reports = await db
    .select()
    .from(reviewReports)
    .where(eq(reviewReports.id, reportId))
    .limit(1);

  if (reports.length === 0) {
    throw new Error('报告不存在');
  }

  const report = reports[0];

  return {
    ...report,
    issues: report.issues ? JSON.parse(report.issues) : [],
    statistics: report.statistics ? JSON.parse(report.statistics) : null,
    recommendations: report.recommendations ? JSON.parse(report.recommendations) : [],
    reviewScope: report.reviewScope ? JSON.parse(report.reviewScope) : null,
  };
}

/**
 * 更新报告状态
 */
export async function updateReportStatus(
  reportId: number,
  status: 'draft' | 'published' | 'archived'
) {
  return db
    .update(reviewReports)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviewReports.id, reportId));
}

/**
 * 删除报告
 */
export async function deleteReport(reportId: number) {
  return db.delete(reviewReports).where(eq(reviewReports.id, reportId));
}

// ============================================
// 报告导出服务
// ============================================

/**
 * 导出报告为HTML
 */
export async function exportReportAsHtml(reportId: number): Promise<string> {
  const report = await getReport(reportId);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #333; padding: 40px; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1890ff; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #1890ff; margin-bottom: 10px; }
    .header .meta { color: #666; font-size: 14px; }
    .score-section { display: flex; justify-content: center; margin: 30px 0; }
    .score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-weight: bold; }
    .score-circle.excellent { background: linear-gradient(135deg, #52c41a, #73d13d); }
    .score-circle.good { background: linear-gradient(135deg, #1890ff, #40a9ff); }
    .score-circle.warning { background: linear-gradient(135deg, #faad14, #ffc53d); }
    .score-circle.danger { background: linear-gradient(135deg, #ff4d4f, #ff7875); }
    .score-value { font-size: 36px; }
    .score-label { font-size: 14px; margin-top: 5px; }
    .section { margin: 30px 0; }
    .section-title { font-size: 18px; font-weight: bold; color: #1890ff; border-left: 4px solid #1890ff; padding-left: 10px; margin-bottom: 15px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: bold; color: #1890ff; }
    .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
    .issue-list { list-style: none; }
    .issue-item { background: #fafafa; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #ccc; }
    .issue-item.error { border-left-color: #ff4d4f; }
    .issue-item.warning { border-left-color: #faad14; }
    .issue-item.info { border-left-color: #1890ff; }
    .issue-title { font-weight: bold; margin-bottom: 5px; }
    .issue-location { color: #666; font-size: 13px; }
    .issue-message { margin: 10px 0; }
    .issue-suggestion { background: #e6f7ff; padding: 10px; border-radius: 4px; font-size: 14px; }
    .recommendation-list { list-style: none; }
    .recommendation-item { background: #f6ffed; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #52c41a; }
    .recommendation-item.high { border-left-color: #ff4d4f; background: #fff2f0; }
    .recommendation-item.medium { border-left-color: #faad14; background: #fffbe6; }
    .recommendation-item.low { border-left-color: #52c41a; }
    .recommendation-title { font-weight: bold; color: #333; }
    .recommendation-desc { color: #666; margin: 8px 0; }
    .recommendation-impact { font-size: 13px; color: #1890ff; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <div class="meta">
      <span>报告编号：${report.reportNo}</span> | 
      <span>生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}</span>
    </div>
  </div>

  <div class="score-section">
    <div class="score-circle ${getScoreClass(report.score)}">
      <span class="score-value">${report.score}</span>
      <span class="score-label">综合评分</span>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${report.statistics?.total || 0}</div>
      <div class="stat-label">总问题数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: #ff4d4f;">${report.statistics?.errors || 0}</div>
      <div class="stat-label">错误</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: #faad14;">${report.statistics?.warnings || 0}</div>
      <div class="stat-label">警告</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: #1890ff;">${report.statistics?.infos || 0}</div>
      <div class="stat-label">提示</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">报告摘要</div>
    <p>${report.summary}</p>
  </div>

  <div class="section">
    <div class="section-title">问题详情</div>
    <ul class="issue-list">
      ${(report.issues as ReportIssue[])?.slice(0, 50).map((issue) => `
        <li class="issue-item ${issue.type}">
          <div class="issue-title">
            <span style="color: ${issue.type === 'error' ? '#ff4d4f' : issue.type === 'warning' ? '#faad14' : '#1890ff'}">
              [${issue.severity === 'critical' ? '严重' : issue.severity === 'major' ? '主要' : '次要'}]
            </span>
            ${issue.category}
          </div>
          ${issue.location.chapterTitle ? `<div class="issue-location">位置：${issue.location.chapterTitle}</div>` : ''}
          <div class="issue-message">${issue.message}</div>
          ${issue.suggestion ? `<div class="issue-suggestion">建议：${issue.suggestion}</div>` : ''}
        </li>
      `).join('')}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">改进建议</div>
    <ul class="recommendation-list">
      ${(report.recommendations as ReportRecommendation[])?.map((rec) => `
        <li class="recommendation-item ${rec.priority}">
          <div class="recommendation-title">
            <span style="color: ${rec.priority === 'high' ? '#ff4d4f' : rec.priority === 'medium' ? '#faad14' : '#52c41a'}">
              [${rec.priority === 'high' ? '高优先级' : rec.priority === 'medium' ? '中优先级' : '低优先级'}]
            </span>
            ${rec.title}
          </div>
          <div class="recommendation-desc">${rec.description}</div>
          <div class="recommendation-impact">影响：${rec.impact}</div>
        </li>
      `).join('')}
    </ul>
  </div>

  <div class="footer">
    <p>本报告由标书全流程管理平台自动生成</p>
    <p>报告编号：${report.reportNo}</p>
  </div>
</body>
</html>`;

  return html;
}

/**
 * 导出报告为Markdown
 */
export async function exportReportAsMarkdown(reportId: number): Promise<string> {
  const report = await getReport(reportId);

  let md = `# ${report.title}\n\n`;
  md += `> 报告编号：${report.reportNo}\n`;
  md += `> 生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}\n\n`;

  // 评分
  md += `## 综合评分\n\n`;
  md += `**${report.score}分**\n\n`;

  // 统计
  md += `## 统计概览\n\n`;
  md += `| 类型 | 数量 |\n|------|------|\n`;
  md += `| 总问题数 | ${report.statistics?.total || 0} |\n`;
  md += `| 错误 | ${report.statistics?.errors || 0} |\n`;
  md += `| 警告 | ${report.statistics?.warnings || 0} |\n`;
  md += `| 提示 | ${report.statistics?.infos || 0} |\n\n`;

  // 摘要
  md += `## 报告摘要\n\n${report.summary}\n\n`;

  // 问题详情
  md += `## 问题详情\n\n`;
  (report.issues as ReportIssue[])?.forEach((issue, index) => {
    const severityIcon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🔵';
    const typeIcon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
    md += `### ${index + 1}. ${severityIcon} ${typeIcon} ${issue.message}\n\n`;
    if (issue.location.chapterTitle) {
      md += `- **位置**：${issue.location.chapterTitle}\n`;
    }
    md += `- **类别**：${issue.category}\n`;
    md += `- **严重程度**：${issue.severity}\n`;
    if (issue.suggestion) {
      md += `- **建议**：${issue.suggestion}\n`;
    }
    md += '\n';
  });

  // 改进建议
  md += `## 改进建议\n\n`;
  (report.recommendations as ReportRecommendation[])?.forEach((rec, index) => {
    const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
    md += `### ${index + 1}. ${priorityIcon} ${rec.title}\n\n`;
    md += `${rec.description}\n\n`;
    md += `**影响**：${rec.impact}\n\n`;
  });

  md += `---\n\n`;
  md += `*本报告由标书全流程管理平台自动生成*\n`;

  return md;
}

/**
 * 获取评分等级样式类
 */
function getScoreClass(score: number | null): string {
  if (!score) return 'warning';
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'warning';
  return 'danger';
}

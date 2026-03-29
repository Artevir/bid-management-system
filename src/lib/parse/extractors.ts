/**
 * 文档解析高级功能
 * 版面解析、章节切分、结构化信息抽取
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import type { ParseItemType as _ParseItemType, ParseResultItem } from './service';

// ============================================
// 章节解析
// ============================================

export interface DocumentSection {
  id: string;
  title: string;
  level: number; // 标题层级 1-6
  content: string;
  pageNumber?: number;
  children?: DocumentSection[];
  type: 'chapter' | 'section' | 'subsection' | 'clause';
}

export interface SectionParseResult {
  sections: DocumentSection[];
  outline: string; // 文档大纲文本
  totalSections: number;
}

/**
 * 解析文档章节结构
 */
export async function parseDocumentSections(
  documentContent: string,
  customHeaders?: Record<string, string>
): Promise<SectionParseResult> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const systemPrompt = `你是一个专业的文档结构分析专家。请分析文档的章节结构，返回JSON格式结果。

返回格式：
{
  "sections": [
    {
      "id": "1",
      "title": "章节标题",
      "level": 1,
      "content": "章节内容摘要（200字以内）",
      "type": "chapter|section|subsection|clause",
      "children": []
    }
  ],
  "outline": "文档大纲文本",
  "totalSections": 10
}

规则：
1. 按照文档原有的层级结构组织章节
2. level表示标题层级（1-6）
3. type区分章节类型
4. children嵌套子章节
5. 每个章节提供简短的内容摘要`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请分析以下文档的章节结构：\n\n${documentContent}` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.2,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as SectionParseResult;
    }

    throw new Error('无法解析章节结构');
  } catch (error) {
    console.error('Section parse error:', error);
    throw error;
  }
}

// ============================================
// 时间节点抽取
// ============================================

export interface DeadlineItem extends ParseResultItem {
  type: 'deadline';
  extraData: {
    date: string; // 日期
    time?: string; // 时间
    eventType: string; // 事件类型
    isCritical: boolean; // 是否关键节点
    reminderDays?: number; // 提前提醒天数
  };
}

export interface DeadlineExtractResult {
  items: DeadlineItem[];
  criticalDates: Array<{
    event: string;
    datetime: string;
    isPast: boolean;
  }>;
}

/**
 * 抽取时间节点信息
 */
export async function extractDeadlines(
  documentContent: string,
  customHeaders?: Record<string, string>
): Promise<DeadlineExtractResult> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const systemPrompt = `你是招标文件时间节点提取专家。请从文档中提取所有时间节点信息。

返回格式：
{
  "items": [
    {
      "type": "deadline",
      "title": "投标截止时间",
      "content": "2024年3月15日上午9:00",
      "originalText": "投标文件递交截止时间：2024年3月15日上午9:00",
      "confidence": 95,
      "extraData": {
        "date": "2024-03-15",
        "time": "09:00",
        "eventType": "submission_deadline",
        "isCritical": true,
        "reminderDays": 3
      }
    }
  ],
  "criticalDates": [
    {
      "event": "投标截止",
      "datetime": "2024-03-15 09:00",
      "isPast": false
    }
  ]
}

事件类型eventType包括：
- registration_deadline: 报名截止
- question_deadline: 答疑截止
- submission_deadline: 投标截止
- open_bid: 开标时间
- validity_period: 投标有效期
- other: 其他

请仔细提取所有时间节点，包括显式和隐式的时间信息。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请提取以下文档的时间节点：\n\n${documentContent}` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.2,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as DeadlineExtractResult;
    }

    throw new Error('无法提取时间节点');
  } catch (error) {
    console.error('Deadline extract error:', error);
    throw error;
  }
}

// ============================================
// 资格条件抽取
// ============================================

export interface QualificationItem extends ParseResultItem {
  type: 'qualification';
  extraData: {
    category: string; // 资格类别
    isRequired: boolean; // 是否必须满足
    isDisqualifying: boolean; // 是否废标项
    verificationMethod?: string; // 验证方式
    documentRequired?: string[]; // 所需证明文件
  };
}

export interface QualificationExtractResult {
  items: QualificationItem[];
  requiredCount: number;
  optionalCount: number;
  disqualifyingItems: string[]; // 废标条款列表
}

/**
 * 抽取资格条件
 */
export async function extractQualifications(
  documentContent: string,
  customHeaders?: Record<string, string>
): Promise<QualificationExtractResult> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const systemPrompt = `你是招标文件资格条件提取专家。请从文档中提取所有资格条件。

返回格式：
{
  "items": [
    {
      "type": "qualification",
      "title": "营业执照要求",
      "content": "投标人须具有独立承担民事责任的能力，提供有效的营业执照",
      "originalText": "投标人须具有独立承担民事责任的能力...",
      "confidence": 95,
      "extraData": {
        "category": "basic",
        "isRequired": true,
        "isDisqualifying": true,
        "verificationMethod": "查验营业执照副本",
        "documentRequired": ["营业执照副本复印件"]
      }
    }
  ],
  "requiredCount": 5,
  "optionalCount": 2,
  "disqualifyingItems": ["不满足XX条件的投标将被拒绝"]
}

资格类别category包括：
- basic: 基本资格条件
- qualification: 资质要求
- performance: 业绩要求
- personnel: 人员要求
- equipment: 设备要求
- financial: 财务要求
- other: 其他

请区分必须满足的条件和加分条件。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请提取以下文档的资格条件：\n\n${documentContent}` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.2,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as QualificationExtractResult;
    }

    throw new Error('无法提取资格条件');
  } catch (error) {
    console.error('Qualification extract error:', error);
    throw error;
  }
}

// ============================================
// 评分项抽取
// ============================================

export interface ScoringItem extends ParseResultItem {
  type: 'scoring_item';
  extraData: {
    score: number; // 分值
    maxScore: number; // 满分
    scoreType: string; // 评分类型
    evaluationMethod?: string; // 评分方法
    competitors?: string[]; // 对比项
  };
}

export interface ScoringExtractResult {
  items: ScoringItem[];
  totalScore: number;
  scoreByType: Record<string, number>; // 按类型统计分值
  scoreItems: Array<{
    category: string;
    maxScore: number;
    itemCount: number;
  }>;
}

/**
 * 抽取评分项
 */
export async function extractScoringItems(
  documentContent: string,
  customHeaders?: Record<string, string>
): Promise<ScoringExtractResult> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders as any);

  const systemPrompt = `你是招标文件评分项提取专家。请从文档中提取所有评分项。

返回格式：
{
  "items": [
    {
      "type": "scoring_item",
      "title": "技术方案评分",
      "content": "技术方案的完整性、可行性、先进性评分，满分30分",
      "originalText": "技术方案（30分）\n方案的完整性（10分）\n方案的可行性（10分）\n方案的先进性（10分）",
      "confidence": 95,
      "extraData": {
        "score": 0,
        "maxScore": 30,
        "scoreType": "technical",
        "evaluationMethod": "专家打分",
        "competitors": []
      }
    }
  ],
  "totalScore": 100,
  "scoreByType": {
    "technical": 60,
    "commercial": 30,
    "other": 10
  },
  "scoreItems": [
    {"category": "技术评分", "maxScore": 60, "itemCount": 10}
  ]
}

评分类型scoreType包括：
- technical: 技术评分
- commercial: 商务评分
- price: 价格评分
- service: 服务评分
- credit: 信誉评分
- other: 其他

请提取所有评分项，包括分值、评分标准和评分方法。`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请提取以下文档的评分项：\n\n${documentContent}` },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.2,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ScoringExtractResult;
    }

    throw new Error('无法提取评分项');
  } catch (error) {
    console.error('Scoring extract error:', error);
    throw error;
  }
}

// ============================================
// 综合解析
// ============================================

export interface ComprehensiveParseResult {
  sections: DocumentSection[];
  deadlines: DeadlineExtractResult;
  qualifications: QualificationExtractResult;
  scoringItems: ScoringExtractResult;
  summary: {
    totalSections: number;
    totalDeadlines: number;
    totalQualifications: number;
    totalScoringItems: number;
    criticalDates: string[];
    disqualifyingCount: number;
  };
}

/**
 * 综合解析文档（分步解析）
 */
export async function comprehensiveParse(
  documentContent: string,
  onProgress?: (step: string, progress: number) => void,
  customHeaders?: Record<string, string>
): Promise<ComprehensiveParseResult> {
  const result: ComprehensiveParseResult = {
    sections: [],
    deadlines: { items: [], criticalDates: [] },
    qualifications: { items: [], requiredCount: 0, optionalCount: 0, disqualifyingItems: [] },
    scoringItems: { items: [], totalScore: 0, scoreByType: {}, scoreItems: [] },
    summary: {
      totalSections: 0,
      totalDeadlines: 0,
      totalQualifications: 0,
      totalScoringItems: 0,
      criticalDates: [],
      disqualifyingCount: 0,
    },
  };

  // 步骤1: 解析章节结构
  onProgress?.('解析章节结构', 10);
  try {
    const sectionResult = await parseDocumentSections(documentContent, customHeaders);
    result.sections = sectionResult.sections;
    result.summary.totalSections = sectionResult.totalSections;
  } catch (error) {
    console.error('Section parse failed:', error);
  }

  // 步骤2: 提取时间节点
  onProgress?.('提取时间节点', 30);
  try {
    const deadlineResult = await extractDeadlines(documentContent, customHeaders);
    result.deadlines = deadlineResult;
    result.summary.totalDeadlines = deadlineResult.items.length;
    result.summary.criticalDates = deadlineResult.criticalDates.map(d => d.datetime);
  } catch (error) {
    console.error('Deadline extraction failed:', error);
  }

  // 步骤3: 提取资格条件
  onProgress?.('提取资格条件', 50);
  try {
    const qualResult = await extractQualifications(documentContent, customHeaders);
    result.qualifications = qualResult;
    result.summary.totalQualifications = qualResult.items.length;
    result.summary.disqualifyingCount = qualResult.disqualifyingItems.length;
  } catch (error) {
    console.error('Qualification extraction failed:', error);
  }

  // 步骤4: 提取评分项
  onProgress?.('提取评分项', 70);
  try {
    const scoreResult = await extractScoringItems(documentContent, customHeaders);
    result.scoringItems = scoreResult;
    result.summary.totalScoringItems = scoreResult.items.length;
  } catch (error) {
    console.error('Scoring extraction failed:', error);
  }

  onProgress?.('解析完成', 100);
  return result;
}

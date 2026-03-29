/**
 * 时间节点AI提取服务
 * 使用大语言模型从招标信息中提取时间节点
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { tenderInfos } from '@/db/schema';
import { eq, isNull, and as _and, gt as _gt } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface TimeNodes {
  /** 报名开始时间 */
  registerStartDate: Date | null;
  /** 报名截止时间 */
  registerEndDate: Date | null;
  /** 答疑截止时间 */
  questionDeadline: Date | null;
  /** 投标截止时间 */
  submissionDeadline: Date | null;
  /** 开标时间 */
  openBidDate: Date | null;
  /** 开标地点 */
  openBidLocation: string | null;
  /** 是否有模糊时间（需要人工确认） */
  hasFuzzyTime: boolean;
  /** 模糊时间说明 */
  fuzzyTimeNote: string | null;
  /** 提取置信度 0-100 */
  confidence: number;
}

export interface ExtractionResult {
  success: boolean;
  timeNodes: TimeNodes;
  rawResponse: string | null;
  error: string | null;
}

// ============================================
// 常量定义
// ============================================

/** 时间节点提取提示词 */
const TIME_EXTRACTION_PROMPT = `你是一个专业的招标文件分析师。请从以下招标信息中提取时间节点信息。

## 输出格式
请严格按照以下JSON格式输出，不要添加任何其他内容：
{
  "registerStartDate": "YYYY-MM-DD HH:mm" 或 null,
  "registerEndDate": "YYYY-MM-DD HH:mm" 或 null,
  "questionDeadline": "YYYY-MM-DD HH:mm" 或 null,
  "submissionDeadline": "YYYY-MM-DD HH:mm" 或 null,
  "openBidDate": "YYYY-MM-DD HH:mm" 或 null,
  "openBidLocation": "开标地点" 或 null,
  "hasFuzzyTime": true/false,
  "fuzzyTimeNote": "模糊时间说明" 或 null,
  "confidence": 0-100
}

## 提取规则
1. **精确时间**：如果文本中有明确的日期和时间，直接提取
2. **模糊时间**：如果时间表述不明确（如"另行通知"、"待定"），设置 hasFuzzyTime=true，并在 fuzzyTimeNote 中说明
3. **相对时间**：如果只有相对时间（如"发布公告之日起5个工作日"），尝试推算绝对日期
4. **置信度**：
   - 100：所有时间节点都非常明确
   - 80-99：大部分时间节点明确
   - 60-79：部分时间节点需要推算
   - 40-59：时间节点不够明确
   - 0-39：时间节点非常模糊

## 注意事项
- 年份默认使用当前年份（2025年）
- 如果只有日期没有时间，时间默认为17:00（工作时间）
- 如果没有找到某个时间节点，设置为null

## 招标信息内容
`;

// ============================================
// 主函数
// ============================================

/**
 * 从招标信息中提取时间节点
 */
export async function extractTimeNodes(content: string): Promise<ExtractionResult> {
  if (!content || content.trim().length === 0) {
    return {
      success: false,
      timeNodes: getEmptyTimeNodes(),
      rawResponse: null,
      error: '内容为空',
    };
  }

  try {
    const config = new Config();
    const client = new LLMClient(config);

    const messages = [
      {
        role: 'user' as const,
        content: TIME_EXTRACTION_PROMPT + content.substring(0, 8000), // 限制内容长度
      },
    ];

    const response = await client.invoke(messages, {
      temperature: 0.3,
    });

    const responseText = response.content || '';

    // 解析JSON响应
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        timeNodes: getEmptyTimeNodes(),
        rawResponse: responseText,
        error: '无法解析AI响应',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const timeNodes: TimeNodes = {
      registerStartDate: parseDate(parsed.registerStartDate),
      registerEndDate: parseDate(parsed.registerEndDate),
      questionDeadline: parseDate(parsed.questionDeadline),
      submissionDeadline: parseDate(parsed.submissionDeadline),
      openBidDate: parseDate(parsed.openBidDate),
      openBidLocation: parsed.openBidLocation || null,
      hasFuzzyTime: parsed.hasFuzzyTime || false,
      fuzzyTimeNote: parsed.fuzzyTimeNote || null,
      confidence: parsed.confidence || 50,
    };

    return {
      success: true,
      timeNodes,
      rawResponse: responseText,
      error: null,
    };
  } catch (error) {
    console.error('时间节点提取失败:', error);
    return {
      success: false,
      timeNodes: getEmptyTimeNodes(),
      rawResponse: null,
      error: error instanceof Error ? error.message : '提取失败',
    };
  }
}

/**
 * 从招标信息ID提取时间节点并更新
 */
export async function extractAndUpdateTimeNodes(tenderInfoId: number): Promise<ExtractionResult> {
  // 获取招标信息
  const [tenderInfo] = await db
    .select()
    .from(tenderInfos)
    .where(eq(tenderInfos.id, tenderInfoId))
    .limit(1);

  if (!tenderInfo) {
    return {
      success: false,
      timeNodes: getEmptyTimeNodes(),
      rawResponse: null,
      error: '招标信息不存在',
    };
  }

  // 如果已经有完整的时间节点，跳过
  if (
    tenderInfo.registerEndDate &&
    tenderInfo.submissionDeadline &&
    tenderInfo.openBidDate
  ) {
    return {
      success: true,
      timeNodes: {
        registerStartDate: tenderInfo.registerStartDate,
        registerEndDate: tenderInfo.registerEndDate,
        questionDeadline: tenderInfo.questionDeadline,
        submissionDeadline: tenderInfo.submissionDeadline,
        openBidDate: tenderInfo.openBidDate,
        openBidLocation: tenderInfo.openBidLocation,
        hasFuzzyTime: false,
        fuzzyTimeNote: null,
        confidence: 100,
      },
      rawResponse: null,
      error: null,
    };
  }

  // 组合内容
  const content = [
    tenderInfo.title,
    tenderInfo.summary,
    tenderInfo.content,
    tenderInfo.requirements,
  ]
    .filter(Boolean)
    .join('\n\n');

  // 提取时间节点
  const result = await extractTimeNodes(content);

  if (result.success) {
    // 更新招标信息
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (result.timeNodes.registerStartDate && !tenderInfo.registerStartDate) {
      updateData.registerStartDate = result.timeNodes.registerStartDate;
    }
    if (result.timeNodes.registerEndDate && !tenderInfo.registerEndDate) {
      updateData.registerEndDate = result.timeNodes.registerEndDate;
    }
    if (result.timeNodes.questionDeadline && !tenderInfo.questionDeadline) {
      updateData.questionDeadline = result.timeNodes.questionDeadline;
    }
    if (result.timeNodes.submissionDeadline && !tenderInfo.submissionDeadline) {
      updateData.submissionDeadline = result.timeNodes.submissionDeadline;
    }
    if (result.timeNodes.openBidDate && !tenderInfo.openBidDate) {
      updateData.openBidDate = result.timeNodes.openBidDate;
    }
    if (result.timeNodes.openBidLocation && !tenderInfo.openBidLocation) {
      updateData.openBidLocation = result.timeNodes.openBidLocation;
    }

    if (Object.keys(updateData).length > 1) {
      await db
        .update(tenderInfos)
        .set(updateData)
        .where(eq(tenderInfos.id, tenderInfoId));
    }
  }

  return result;
}

/**
 * 批量提取招标信息的时间节点
 */
export async function batchExtractTimeNodes(options?: {
  limit?: number;
  onlyMissing?: boolean;
}): Promise<{
  total: number;
  success: number;
  failed: number;
}> {
  const limit = options?.limit || 50;

  // 查询需要提取的招标信息
  let tenderInfoList;

  if (options?.onlyMissing) {
    // 只提取缺少时间节点的
    tenderInfoList = await db
      .select()
      .from(tenderInfos)
      .where(isNull(tenderInfos.submissionDeadline))
      .limit(limit);
  } else {
    tenderInfoList = await db
      .select()
      .from(tenderInfos)
      .limit(limit);
  }

  let success = 0;
  let failed = 0;

  for (const tenderInfo of tenderInfoList) {
    try {
      const result = await extractAndUpdateTimeNodes(tenderInfo.id);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`提取失败 [${tenderInfo.id}]:`, error);
      failed++;
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    total: tenderInfoList.length,
    success,
    failed,
  };
}

// ============================================
// 辅助函数
// ============================================

/**
 * 解析日期字符串
 */
function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  try {
    // 尝试多种日期格式
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/, // YYYY-MM-DD HH:mm
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
      /^(\d{4})年(\d{1,2})月(\d{1,2})日/, // YYYY年MM月DD日
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0]) {
          return new Date(
            parseInt(match[1]),
            parseInt(match[2]) - 1,
            parseInt(match[3]),
            parseInt(match[4]),
            parseInt(match[5])
          );
        } else if (format === formats[1]) {
          return new Date(
            parseInt(match[1]),
            parseInt(match[2]) - 1,
            parseInt(match[3]),
            17, 0 // 默认下午5点
          );
        }
      }
    }

    // 尝试直接解析
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 获取空的时间节点
 */
function getEmptyTimeNodes(): TimeNodes {
  return {
    registerStartDate: null,
    registerEndDate: null,
    questionDeadline: null,
    submissionDeadline: null,
    openBidDate: null,
    openBidLocation: null,
    hasFuzzyTime: false,
    fuzzyTimeNote: null,
    confidence: 0,
  };
}

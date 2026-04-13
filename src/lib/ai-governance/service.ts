/**
 * AI治理服务
 * 提供AI评测集管理、回归测试、质量评估等功能
 */

import { db } from '@/db';
import {
  aiEvaluationSets,
  aiTestCases,
  aiTestRuns,
  aiTestCaseResults,
  aiQualityMetrics,
} from '@/db/schema';
import { eq, and, desc, avg, count as _count } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface EvaluationSetParams {
  name: string;
  description?: string;
  category: string; // generation/qa/translation/summary等
  testCases: TestCaseParams[];
}

export interface TestCaseParams {
  id: string;
  input: string;
  expectedOutput?: string;
  criteria: Record<string, unknown>; // 评估标准
  weight: number; // 权重
  tags?: string[];
}

export interface TestRunParams {
  evaluationSetId: number;
  modelId: string;
  parameters?: Record<string, unknown>;
}

export interface TestRunResult {
  testCaseId: string;
  input: string;
  actualOutput: string;
  expectedOutput?: string;
  score: number; // 0-100
  passed: boolean;
  latency: number; // 响应时间（毫秒）
  error?: string;
}

export interface QualityMetric {
  category: string;
  metricName: string;
  metricValue: number;
  threshold: number;
  passed: boolean;
}

// ============================================
// 评测集管理
// ============================================

/**
 * 创建评测集
 */
export async function createEvaluationSet(
  params: EvaluationSetParams,
  userId: number
): Promise<number> {
  const [evalSet] = await db
    .insert(aiEvaluationSets)
    .values({
      name: params.name,
      description: params.description,
      category: params.category,
      testCaseCount: params.testCases.length,
      createdBy: userId,
    })
    .returning();

  // 创建测试用例
  for (const testCase of params.testCases) {
    await db.insert(aiTestCases).values({
      evaluationSetId: evalSet.id,
      caseId: testCase.id,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      criteria: JSON.stringify(testCase.criteria),
      weight: testCase.weight,
      tags: testCase.tags ? JSON.stringify(testCase.tags) : null,
    });
  }

  return evalSet.id;
}

/**
 * 获取评测集列表
 */
export async function getEvaluationSets(category?: string) {
  const conditions = category ? [eq(aiEvaluationSets.category, category)] : [];

  const sets = await db
    .select()
    .from(aiEvaluationSets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiEvaluationSets.createdAt));

  return sets;
}

/**
 * 获取评测集详情（含测试用例）
 */
export async function getEvaluationSetDetail(setId: number) {
  const evalSet = await db
    .select()
    .from(aiEvaluationSets)
    .where(eq(aiEvaluationSets.id, setId))
    .limit(1);

  if (evalSet.length === 0) {
    return null;
  }

  const testCases = await db
    .select()
    .from(aiTestCases)
    .where(eq(aiTestCases.evaluationSetId, setId));

  return {
    ...evalSet[0],
    testCases,
  };
}

// ============================================
// 回归测试
// ============================================

/**
 * 执行回归测试
 */
export async function runRegressionTest(
  params: TestRunParams,
  customHeaders?: Record<string, string>
): Promise<number> {
  // 1. 获取评测集和测试用例
  const evalSet = await getEvaluationSetDetail(params.evaluationSetId);

  if (!evalSet) {
    throw new Error('评测集不存在');
  }

  // 2. 创建测试运行记录
  const [testRun] = await db
    .insert(aiTestRuns)
    .values({
      evaluationSetId: params.evaluationSetId,
      modelId: params.modelId,
      parameters: params.parameters ? JSON.stringify(params.parameters) : null,
      status: 'running',
      totalCases: evalSet.testCases.length,
    })
    .returning();

  // 3. 异步执行测试
  executeTestCases(
    testRun.id,
    evalSet.testCases,
    params.modelId,
    params.parameters,
    customHeaders
  ).catch(console.error);

  return testRun.id;
}

/**
 * 异步执行测试用例
 */
async function executeTestCases(
  runId: number,
  testCases: (typeof aiTestCases.$inferSelect)[],
  modelId: string,
  parameters?: Record<string, unknown>,
  customHeaders?: Record<string, string>
): Promise<void> {
  const { LLMClient, Config } = await import('coze-coding-dev-sdk');
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  let passedCount = 0;
  let failedCount = 0;
  let totalScore = 0;
  let totalLatency = 0;

  for (const testCase of testCases) {
    try {
      const startTime = Date.now();

      // 调用LLM
      const response = await client.invoke([{ role: 'user' as const, content: testCase.input }], {
        model: modelId,
        temperature: (parameters?.temperature as number) ?? 0.7,
      });

      const latency = Date.now() - startTime;
      const actualOutput = response.content;

      // 评估输出
      const criteria = JSON.parse((testCase.criteria as string) || '{}');
      const { score, passed } = evaluateOutput(actualOutput, testCase.expectedOutput, criteria);

      // 保存测试用例结果
      await db.insert(aiTestCaseResults).values({
        testRunId: runId,
        testCaseId: testCase.id,
        caseCode: testCase.caseId,
        input: testCase.input,
        actualOutput,
        expectedOutput: testCase.expectedOutput,
        score,
        passed,
        latency,
        tokenInput: (response as any).usage?.prompt_tokens,
        tokenOutput: (response as any).usage?.completion_tokens,
        evaluatedAt: new Date(),
      });

      totalScore += score * testCase.weight;
      totalLatency += latency;
      if (passed) passedCount++;
      else failedCount++;
    } catch (error) {
      failedCount++;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error(`Test case ${testCase.caseId} failed:`, error);

      // 保存失败结果
      await db.insert(aiTestCaseResults).values({
        testRunId: runId,
        testCaseId: testCase.id,
        caseCode: testCase.caseId,
        input: testCase.input,
        actualOutput: null,
        expectedOutput: testCase.expectedOutput,
        score: 0,
        passed: false,
        latency: 0,
        errorMessage,
        evaluatedAt: new Date(),
      });
    }
  }

  // 更新测试运行记录
  const avgScore = totalScore / testCases.reduce((sum, tc) => sum + tc.weight, 0);
  const avgLatency = totalLatency / testCases.length;

  await db
    .update(aiTestRuns)
    .set({
      status: 'completed',
      passedCases: passedCount,
      failedCases: failedCount,
      avgScore: Math.round(avgScore * 100) / 100,
      avgLatency: Math.round(avgLatency),
      completedAt: new Date(),
    })
    .where(eq(aiTestRuns.id, runId));

  // 更新质量指标
  await updateQualityMetrics(modelId, {
    category: 'regression',
    metricName: 'pass_rate',
    metricValue: (passedCount / testCases.length) * 100,
  });
}

/**
 * 评估输出质量
 */
function evaluateOutput(
  actualOutput: string,
  expectedOutput: string | null,
  criteria: Record<string, unknown>
): { score: number; passed: boolean } {
  let score = 100;

  // 如果有预期输出，计算相似度
  if (expectedOutput) {
    const similarity = calculateSimilarity(actualOutput, expectedOutput);
    score = similarity * 100;
  }

  // 应用评估标准
  if (criteria.minWords) {
    const wordCount = actualOutput.split(/\s+/).length;
    if (wordCount < (criteria.minWords as number)) {
      score -= 10;
    }
  }

  if (criteria.maxWords) {
    const wordCount = actualOutput.split(/\s+/).length;
    if (wordCount > (criteria.maxWords as number)) {
      score -= 10;
    }
  }

  if (criteria.requiredKeywords) {
    const keywords = criteria.requiredKeywords as string[];
    const found = keywords.filter((k) =>
      actualOutput.toLowerCase().includes(k.toLowerCase())
    ).length;
    score = score * (found / keywords.length);
  }

  const threshold = (criteria.passThreshold as number) ?? 60;
  const passed = score >= threshold;

  return { score: Math.max(0, Math.min(100, score)), passed };
}

/**
 * 计算文本相似度（简化版Jaccard相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * 获取测试运行结果
 */
export async function getTestRunResult(runId: number) {
  const run = await db.select().from(aiTestRuns).where(eq(aiTestRuns.id, runId)).limit(1);

  return run.length > 0 ? run[0] : null;
}

/**
 * 获取测试运行的详细用例结果
 */
export async function getTestRunCaseResults(runId: number) {
  const results = await db
    .select()
    .from(aiTestCaseResults)
    .where(eq(aiTestCaseResults.testRunId, runId));

  return results;
}

/**
 * 获取测试运行的完整详情（含用例结果）
 */
export async function getTestRunDetail(runId: number) {
  const run = await getTestRunResult(runId);

  if (!run) {
    return null;
  }

  const caseResults = await getTestRunCaseResults(runId);

  // 获取评测集信息
  const evalSet = await db
    .select()
    .from(aiEvaluationSets)
    .where(eq(aiEvaluationSets.id, run.evaluationSetId))
    .limit(1);

  return {
    ...run,
    evaluationSet: evalSet.length > 0 ? evalSet[0] : null,
    caseResults,
  };
}

/**
 * 获取模型的历史测试结果
 */
export async function getModelTestHistory(modelId: string, limit: number = 10) {
  const runs = await db
    .select()
    .from(aiTestRuns)
    .where(eq(aiTestRuns.modelId, modelId))
    .orderBy(desc(aiTestRuns.createdAt))
    .limit(limit);

  return runs;
}

// ============================================
// 质量指标管理
// ============================================

/**
 * 更新质量指标
 */
async function updateQualityMetrics(
  modelId: string,
  metric: {
    category: string;
    metricName: string;
    metricValue: number;
  }
): Promise<void> {
  // 检查是否已存在该指标
  const existing = await db
    .select()
    .from(aiQualityMetrics)
    .where(
      and(
        eq(aiQualityMetrics.modelId, modelId),
        eq(aiQualityMetrics.category, metric.category),
        eq(aiQualityMetrics.metricName, metric.metricName)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // 更新现有指标（使用移动平均）
    const newValue = existing[0].metricValue * 0.8 + metric.metricValue * 0.2;
    await db
      .update(aiQualityMetrics)
      .set({
        metricValue: newValue,
        updatedAt: new Date(),
      })
      .where(eq(aiQualityMetrics.id, existing[0].id));
  } else {
    // 创建新指标
    await db.insert(aiQualityMetrics).values({
      modelId,
      category: metric.category,
      metricName: metric.metricName,
      metricValue: metric.metricValue,
      threshold: 70, // 默认阈值
    });
  }
}

/**
 * 获取模型质量指标
 */
export async function getModelQualityMetrics(modelId: string): Promise<QualityMetric[]> {
  const metrics = await db
    .select()
    .from(aiQualityMetrics)
    .where(eq(aiQualityMetrics.modelId, modelId));

  return metrics.map((m) => ({
    category: m.category,
    metricName: m.metricName,
    metricValue: m.metricValue,
    threshold: m.threshold,
    passed: m.metricValue >= m.threshold,
  }));
}

/**
 * 获取所有模型的质量概览
 */
export async function getQualityOverview() {
  const metrics = await db
    .select({
      modelId: aiQualityMetrics.modelId,
      category: aiQualityMetrics.category,
      avgValue: avg(aiQualityMetrics.metricValue),
    })
    .from(aiQualityMetrics)
    .groupBy(aiQualityMetrics.modelId, aiQualityMetrics.category);

  return metrics;
}

/**
 * AI治理API
 * 提供评测集管理、回归测试、质量指标等接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  createEvaluationSet,
  getEvaluationSets,
  getEvaluationSetDetail,
  runRegressionTest,
  getTestRunResult,
  getTestRunDetail,
  getTestRunCaseResults,
  getModelTestHistory,
  getModelQualityMetrics,
  getQualityOverview,
} from '@/lib/ai-governance/service';

// ============================================
// 评测集管理
// ============================================

async function listEvaluationSets(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;

    const sets = await getEvaluationSets(category);

    return NextResponse.json({ sets, total: sets.length });
  } catch (error) {
    console.error('Get evaluation sets error:', error);
    return NextResponse.json({ error: '获取评测集失败' }, { status: 500 });
  }
}

async function getEvaluationSet(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const setId = parseInt(searchParams.get('setId') || '0');

    if (!setId) {
      return NextResponse.json({ error: '缺少评测集ID' }, { status: 400 });
    }

    const detail = await getEvaluationSetDetail(setId);

    if (!detail) {
      return NextResponse.json({ error: '评测集不存在' }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    console.error('Get evaluation set error:', error);
    return NextResponse.json({ error: '获取评测集详情失败' }, { status: 500 });
  }
}

async function createEvalSet(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    const setId = await createEvaluationSet(body, userId);

    return NextResponse.json({
      success: true,
      message: '评测集创建成功',
      setId,
    });
  } catch (error) {
    console.error('Create evaluation set error:', error);
    return NextResponse.json({ error: '创建评测集失败' }, { status: 500 });
  }
}

// ============================================
// 回归测试
// ============================================

async function startTestRun(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { evaluationSetId, modelId, parameters } = body;

    if (!evaluationSetId || !modelId) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const runId = await runRegressionTest({
      evaluationSetId,
      modelId,
      parameters,
    });

    return NextResponse.json({
      success: true,
      message: '回归测试已启动',
      runId,
    });
  } catch (error) {
    console.error('Start test run error:', error);
    return NextResponse.json({ error: '启动测试失败' }, { status: 500 });
  }
}

async function getRunResult(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const runId = parseInt(searchParams.get('runId') || '0');

    if (!runId) {
      return NextResponse.json({ error: '缺少测试运行ID' }, { status: 400 });
    }

    const result = await getTestRunResult(runId);

    if (!result) {
      return NextResponse.json({ error: '测试运行不存在' }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Get test run result error:', error);
    return NextResponse.json({ error: '获取测试结果失败' }, { status: 500 });
  }
}

async function getRunDetail(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const runId = parseInt(searchParams.get('runId') || '0');

    if (!runId) {
      return NextResponse.json({ error: '缺少测试运行ID' }, { status: 400 });
    }

    const detail = await getTestRunDetail(runId);

    if (!detail) {
      return NextResponse.json({ error: '测试运行不存在' }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    console.error('Get test run detail error:', error);
    return NextResponse.json({ error: '获取测试详情失败' }, { status: 500 });
  }
}

async function getCaseResults(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const runId = parseInt(searchParams.get('runId') || '0');

    if (!runId) {
      return NextResponse.json({ error: '缺少测试运行ID' }, { status: 400 });
    }

    const results = await getTestRunCaseResults(runId);

    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    console.error('Get case results error:', error);
    return NextResponse.json({ error: '获取用例结果失败' }, { status: 500 });
  }
}

async function getModelHistory(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!modelId) {
      return NextResponse.json({ error: '缺少模型ID' }, { status: 400 });
    }

    const history = await getModelTestHistory(modelId, limit);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Get model history error:', error);
    return NextResponse.json({ error: '获取历史记录失败' }, { status: 500 });
  }
}

// ============================================
// 质量指标
// ============================================

async function getModelMetrics(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ error: '缺少模型ID' }, { status: 400 });
    }

    const metrics = await getModelQualityMetrics(modelId);

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Get model metrics error:', error);
    return NextResponse.json({ error: '获取质量指标失败' }, { status: 500 });
  }
}

async function getOverview(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const overview = await getQualityOverview();

    return NextResponse.json({ overview });
  } catch (error) {
    console.error('Get quality overview error:', error);
    return NextResponse.json({ error: '获取质量概览失败' }, { status: 500 });
  }
}

// ============================================
// 路由分发
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'eval-set':
      return withAuth(request, getEvaluationSet);
    case 'run-result':
      return withAuth(request, getRunResult);
    case 'run-detail':
      return withAuth(request, getRunDetail);
    case 'case-results':
      return withAuth(request, getCaseResults);
    case 'model-history':
      return withAuth(request, getModelHistory);
    case 'model-metrics':
      return withAuth(request, getModelMetrics);
    case 'overview':
      return withAuth(request, getOverview);
    default:
      return withAuth(request, listEvaluationSets);
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'create-set') {
    return withAuth(request, createEvalSet);
  }

  if (action === 'run-test') {
    return withAuth(request, startTestRun);
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

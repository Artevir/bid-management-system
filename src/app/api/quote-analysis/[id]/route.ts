/**
 * 报价分析详情API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getQuoteAnalysisRequestById,
  updateQuoteAnalysisRequest,
  performQuoteAnalysis,
  getQuoteFactorsByRequestId,
  getCompetitorPredictionsByRequestId,
  getQuoteSchemesByRequestId,
  getHistoryComparisonsByRequestId,
} from '@/lib/quote-analysis/service';

// GET /api/quote-analysis/[id] - 获取报价分析详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const requestId = parseInt(id);

    const request = await getQuoteAnalysisRequestById(requestId);
    if (!request) {
      return NextResponse.json({ error: '报价分析不存在' }, { status: 404 });
    }

    // 获取相关数据
    const [factors, predictions, schemes, historyComparisons] = await Promise.all([
      getQuoteFactorsByRequestId(requestId),
      getCompetitorPredictionsByRequestId(requestId),
      getQuoteSchemesByRequestId(requestId),
      getHistoryComparisonsByRequestId(requestId),
    ]);

    return NextResponse.json({
      ...request,
      factors,
      predictions,
      schemes,
      historyComparisons,
    });
  } catch (error) {
    console.error('获取报价分析详情失败:', error);
    return NextResponse.json({ error: '获取报价分析详情失败' }, { status: 500 });
  }
}

// PUT /api/quote-analysis/[id] - 更新报价分析
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const requestId = parseInt(id);
    const body = await req.json();

    // 如果是执行分析请求
    if (body.action === 'analyze') {
      const result = await performQuoteAnalysis(requestId);
      return NextResponse.json(result);
    }

    // 常规更新
    const updateData: any = {};
    if (body.projectName !== undefined) updateData.projectName = body.projectName;
    if (body.budget !== undefined) updateData.budget = body.budget;
    if (body.strategy !== undefined) updateData.strategy = body.strategy;
    if (body.status !== undefined) updateData.status = body.status;

    const request = await updateQuoteAnalysisRequest(requestId, updateData);

    return NextResponse.json(request);
  } catch (error) {
    console.error('更新报价分析失败:', error);
    return NextResponse.json({ error: '更新报价分析失败' }, { status: 500 });
  }
}

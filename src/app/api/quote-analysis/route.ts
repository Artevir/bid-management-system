/**
 * 智能报价建议API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createQuoteAnalysisRequest,
  getQuoteAnalysisRequests,
  getQuoteAnalysisRequestById,
  updateQuoteAnalysisRequest,
  performQuoteAnalysis,
  getQuoteAnalysisStatistics,
} from '@/lib/quote-analysis/service';

// GET /api/quote-analysis - 获取报价分析列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    // 特殊路由处理
    const path = req.nextUrl.pathname;
    if (path.endsWith('/statistics')) {
      const stats = await getQuoteAnalysisStatistics(session.user.id);
      return NextResponse.json(stats);
    }

    // 常规查询
    const filters = {
      projectId: searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined,
      status: searchParams.get('status') || undefined,
      strategy: searchParams.get('strategy') || undefined,
      createdBy: searchParams.get('createdBy') ? parseInt(searchParams.get('createdBy')!) : session.user.id,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
    };

    const result = await getQuoteAnalysisRequests(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取报价分析列表失败:', error);
    return NextResponse.json({ error: '获取报价分析列表失败' }, { status: 500 });
  }
}

// POST /api/quote-analysis - 创建报价分析请求
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const analysisRequest = await createQuoteAnalysisRequest({
      projectId: body.projectId || null,
      projectName: body.projectName,
      tenderCode: body.tenderCode || null,
      tenderOrganization: body.tenderOrganization || null,
      projectType: body.projectType || null,
      industry: body.industry || null,
      region: body.region || null,
      budget: body.budget || null,
      estimatedCost: body.estimatedCost || null,
      scoringMethod: body.scoringMethod || null,
      priceWeight: body.priceWeight || null,
      knownCompetitors: body.knownCompetitors || null,
      strategy: body.strategy || 'balanced',
      status: 'pending',
      createdBy: session.user.id,
    });

    // 如果需要立即分析
    if (body.analyzeImmediately) {
      // 异步执行分析
      performQuoteAnalysis(analysisRequest.id).catch(err => {
        console.error('报价分析执行失败:', err);
      });
    }

    return NextResponse.json(analysisRequest);
  } catch (error) {
    console.error('创建报价分析请求失败:', error);
    return NextResponse.json({ error: '创建报价分析请求失败' }, { status: 500 });
  }
}

/**
 * 智能报价建议API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { quoteStrategyService, historicalAnalysisService as _historicalAnalysisService, costModelService as _costModelService } from '@/lib/quote/service';

// GET /api/quotes/suggestion - 获取报价建议
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const budgetPrice = searchParams.get('budgetPrice') ? parseFloat(searchParams.get('budgetPrice')!) : undefined;
    const industry = searchParams.get('industry') || undefined;
    const region = searchParams.get('region') || undefined;
    const strategy = (searchParams.get('strategy') || 'balanced') as 'aggressive' | 'balanced' | 'conservative';

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const suggestion = await quoteStrategyService.generateSuggestion({
      projectId: parseInt(projectId),
      budgetPrice,
      industry,
      region,
      strategy,
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('获取报价建议失败:', error);
    return NextResponse.json({ error: '获取报价建议失败' }, { status: 500 });
  }
}

// POST /api/quotes/suggestion - 生成报价建议
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const suggestion = await quoteStrategyService.generateSuggestion({
      projectId: body.projectId,
      budgetPrice: body.budgetPrice,
      industry: body.industry,
      region: body.region,
      costEstimate: body.costEstimate,
      strategy: body.strategy || 'balanced',
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('生成报价建议失败:', error);
    return NextResponse.json({ error: '生成报价建议失败' }, { status: 500 });
  }
}

/**
 * AI智能推荐API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIRecommendationService, RecommendationType } from '@/lib/ai/recommendation-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';

// ============================================
// POST - 获取推荐
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (!type) {
      return NextResponse.json(
        { error: '缺少type参数' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const service = new AIRecommendationService(customHeaders);

    let recommendations;

    switch (type) {
      case RecommendationType.PROJECT_TEMPLATE:
        recommendations = await service.getProjectRecommendations(data);
        break;

      case RecommendationType.DOCUMENT_TEMPLATE:
        recommendations = await service.getDocumentTemplateRecommendations(data);
        break;

      case RecommendationType.RISK_ASSESSMENT:
        recommendations = await service.getRiskAssessment(data);
        break;

      case RecommendationType.BEST_PRACTICE:
        recommendations = await service.getBestPractices(data);
        break;

      case RecommendationType.OPTIMIZATION_SUGGESTION:
        recommendations = await service.getOptimizationSuggestions(data);
        break;

      default:
        return NextResponse.json(
          { error: '不支持的推荐类型' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      type,
      recommendations,
      count: recommendations.length,
    });
  } catch (error: any) {
    console.error('AI recommendation error:', error);
    return NextResponse.json(
      { error: error.message || '获取推荐失败' },
      { status: 500 }
    );
  }
}

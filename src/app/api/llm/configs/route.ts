/**
 * LLM配置管理 API
 * GET: 获取配置列表或模型列表
 * POST: 创建配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getConfigList,
  createConfig,
  getAvailableModels,
  LLMConfigCreate,
} from '@/lib/llm/service';

// 获取配置列表或模型列表
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // 判断是获取模型列表还是配置列表
    if (searchParams.get('models') === 'true') {
      const models = await getAvailableModels();
      return NextResponse.json({ models });
    }

    const params = {
      provider: searchParams.get('provider') as any,
      status: searchParams.get('status') || undefined,
      createdBy: searchParams.get('createdBy') ? parseInt(searchParams.get('createdBy')!) : undefined,
    };

    const configs = await getConfigList(params);

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('获取LLM配置失败:', error);
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 });
  }
}

// 创建配置
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name || !body.provider || !body.modelId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const data: LLMConfigCreate = {
      name: body.name,
      code: body.code,
      description: body.description,
      provider: body.provider,
      modelId: body.modelId,
      apiKey: body.apiKey,
      apiEndpoint: body.apiEndpoint,
      apiVersion: body.apiVersion,
      defaultTemperature: body.defaultTemperature,
      maxTokens: body.maxTokens,
      defaultThinking: body.defaultThinking,
      defaultCaching: body.defaultCaching,
      extraConfig: body.extraConfig,
      scope: body.scope,
      createdBy: user.userId,
    };

    const config = await createConfig(data);

    return NextResponse.json(
      {
        success: true,
        message: '配置创建成功',
        config,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('创建LLM配置失败:', error);
    return NextResponse.json(
      { error: error.message || '创建配置失败' },
      { status: 400 }
    );
  }
}

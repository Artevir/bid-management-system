/**
 * LLM模型管理 API
 * GET: 获取模型列表
 * POST: 创建模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getAvailableModels,
  createModel,
  createModels,
  initializeDefaultModels,
  searchModels,
  type ModelProvider,
  type ModelType,
  type ModelStatus,
} from '@/lib/llm/model-service';

// GET /api/llm/models
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as ModelProvider | null;
    const modelType = searchParams.get('modelType') as ModelType | null;
    const status = searchParams.get('status') as ModelStatus | null;
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const init = searchParams.get('init') === 'true';

    // 初始化默认模型
    if (init) {
      await initializeDefaultModels();
    }

    // 搜索模式
    if (search) {
      const models = await searchModels(search);
      return NextResponse.json({ models });
    }

    // 列表模式
    const models = await getAvailableModels({
      provider: provider || undefined,
      modelType: modelType || undefined,
      status: status || undefined,
      includeInactive,
    });

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('获取模型列表失败:', error);
    return NextResponse.json(
      { error: error.message || '获取模型列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/llm/models
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();

    // 批量创建
    if (Array.isArray(body.models)) {
      const models = await createModels(body.models);
      return NextResponse.json({ success: true, models, count: models.length });
    }

    // 单个创建
    const model = await createModel(body);
    return NextResponse.json({ success: true, model });
  } catch (error: any) {
    console.error('创建模型失败:', error);
    
    // 处理唯一约束冲突
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '模型ID已存在' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || '创建模型失败' },
      { status: 500 }
    );
  }
}

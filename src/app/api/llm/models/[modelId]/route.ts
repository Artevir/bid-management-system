/**
 * LLM模型详情 API
 * GET: 获取模型详情
 * PUT: 更新模型
 * DELETE: 删除模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getModelById,
  updateModel,
  deleteModel,
} from '@/lib/llm/model-service';

// GET /api/llm/models/[modelId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const { modelId } = await params;
    const model = await getModelById(modelId);

    if (!model) {
      return NextResponse.json({ error: '模型不存在' }, { status: 404 });
    }

    return NextResponse.json({ model });
  } catch (error: any) {
    console.error('获取模型详情失败:', error);
    return NextResponse.json(
      { error: error.message || '获取模型详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/llm/models/[modelId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { modelId } = await params;
    const body = await request.json();

    const model = await updateModel(modelId, body);

    if (!model) {
      return NextResponse.json({ error: '模型不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, model });
  } catch (error: any) {
    console.error('更新模型失败:', error);
    return NextResponse.json(
      { error: error.message || '更新模型失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/llm/models/[modelId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { modelId } = await params;
    await deleteModel(modelId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('删除模型失败:', error);
    return NextResponse.json(
      { error: error.message || '删除模型失败' },
      { status: 500 }
    );
  }
}

/**
 * LLM配置详情 API
 * GET: 获取配置详情
 * PUT: 更新配置
 * DELETE: 删除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getConfigById,
  updateConfig,
  deleteConfig,
  setDefaultConfig,
} from '@/lib/llm/service';

// 获取配置详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: '无效的配置ID' }, { status: 400 });
    }

    const config = await getConfigById(configId);

    if (!config) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    }

    // 隐藏API Key敏感信息
    if (config.apiKey) {
      config.apiKey = '******';
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('获取LLM配置详情失败:', error);
    return NextResponse.json({ error: '获取配置详情失败' }, { status: 500 });
  }
}

// 更新配置
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: '无效的配置ID' }, { status: 400 });
    }

    const body = await request.json();

    // 设置默认配置
    if (body.action === 'setDefault') {
      await setDefaultConfig(configId);
      return NextResponse.json({ success: true, message: '已设为默认配置' });
    }

    // 不更新apiKey如果传的是掩码值
    if (body.apiKey === '******') {
      delete body.apiKey;
    }

    const config = await updateConfig(configId, body);

    return NextResponse.json({
      success: true,
      message: '更新成功',
      config,
    });
  } catch (error: any) {
    console.error('更新LLM配置失败:', error);
    return NextResponse.json(
      { error: error.message || '更新配置失败' },
      { status: 400 }
    );
  }
}

// 删除配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const configId = parseInt(id, 10);

    if (isNaN(configId)) {
      return NextResponse.json({ error: '无效的配置ID' }, { status: 400 });
    }

    await deleteConfig(configId);

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('删除LLM配置失败:', error);
    return NextResponse.json(
      { error: error.message || '删除配置失败' },
      { status: 400 }
    );
  }
}

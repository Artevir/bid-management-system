/**
 * 图片生成详情API
 * GET - 获取图片生成详情
 * DELETE - 删除图片生成记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { z as _z } from 'zod';

// ============================================
// GET - 获取图片生成详情
// ============================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 获取当前用户
    const user = await requireAuth();

    // 验证参数
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    // 获取详情
    const { getImageGeneration } = await import('@/lib/image-generation/service');
    const record = await getImageGeneration(idNum);
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    // 检查权限
    if (record.createdBy !== user.id) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('获取图片生成详情失败:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取图片生成详情失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除图片生成记录
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 获取当前用户
    const user = await requireAuth();

    // 验证参数
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    // 获取详情并检查权限
    const { getImageGeneration, deleteImageGeneration } =
      await import('@/lib/image-generation/service');
    const record = await getImageGeneration(idNum);
    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    if (record.createdBy !== user.id) {
      return NextResponse.json({ error: '无权删除' }, { status: 403 });
    }

    // 删除记录
    await deleteImageGeneration(idNum);

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除图片生成记录失败:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除图片生成记录失败' },
      { status: 500 }
    );
  }
}

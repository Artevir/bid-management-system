/**
 * 响应矩阵API
 * GET: 获取响应矩阵列表
 * POST: 创建响应矩阵
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { responseMatrices, parseItems as _parseItems } from '@/db/schema';
import { eq, and as _and } from 'drizzle-orm';

// 获取响应矩阵列表
async function getMatrixList(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const matrix = await db
      .select()
      .from(responseMatrices)
      .where(eq(responseMatrices.projectId, parseInt(projectId)));

    return NextResponse.json({ matrix });
  } catch (error) {
    console.error('Get response matrix error:', error);
    return NextResponse.json({ error: '获取响应矩阵失败' }, { status: 500 });
  }
}

// 创建响应矩阵
async function createMatrix(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { projectId, name, description } = body;

    if (!projectId || !name) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const [matrixRecord] = await db
      .insert(responseMatrices)
      .values({
        projectId,
        name,
        description: description || null,
        status: 'draft',
        createdBy: userId,
      })
      .returning();

    // 自动从解析项生成矩阵项
    // 注意：parseItems表没有projectId字段，需要通过parseTasks关联
    // TODO: 在MATRIX-003中实现从解析项生成矩阵项的逻辑

    return NextResponse.json({
      success: true,
      matrix: matrixRecord,
      message: '响应矩阵创建成功',
    });
  } catch (error) {
    console.error('Create response matrix error:', error);
    return NextResponse.json({ error: '创建响应矩阵失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getMatrixList(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createMatrix(req, userId));
}

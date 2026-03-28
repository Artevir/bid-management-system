/**
 * 知识版本API
 * GET: 获取知识条目的版本历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getKnowledgeVersions, updateKnowledgeItem } from '@/lib/knowledge/import';
import { HeaderUtils } from 'coze-coding-dev-sdk';

// 获取版本历史
async function getVersions(
  request: NextRequest,
  userId: number,
  itemId: number
): Promise<NextResponse> {
  try {
    const versions = await getKnowledgeVersions(itemId);
    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    return NextResponse.json({ error: '获取版本历史失败' }, { status: 500 });
  }
}

// 创建新版本
async function createVersion(
  request: NextRequest,
  userId: number,
  itemId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { title, content, keywords, changeLog } = body;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    await updateKnowledgeItem(
      itemId,
      { title, content, keywords },
      userId,
      changeLog,
      customHeaders
    );

    return NextResponse.json({
      success: true,
      message: '版本更新成功',
    });
  } catch (error) {
    console.error('Create version error:', error);
    return NextResponse.json({ error: '创建版本失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getVersions(req, userId, parseInt(id)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => createVersion(req, userId, parseInt(id)));
}

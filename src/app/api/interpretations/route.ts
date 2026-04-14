/**
 * 招标文件解读记录API
 * GET: 获取解读记录列表
 * POST: 创建新的解读记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils as _HeaderUtils } from 'coze-coding-dev-sdk';
import {
  getInterpretationList,
  createInterpretation,
  getInterpretationStats,
} from '@/lib/interpretation/service';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'parsing' | 'completed' | 'failed' | null;
    const reviewStatus = searchParams.get('reviewStatus') as 'pending' | 'approved' | 'rejected' | null;
    const keyword = searchParams.get('keyword') || undefined;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 获取列表
    const result = await getInterpretationList({
      status: status || undefined,
      reviewStatus: reviewStatus || undefined,
      keyword,
      projectId,
      uploaderId: user.userId,
      page,
      pageSize,
    });

    // 获取统计信息
    const stats = await getInterpretationStats(user.userId);

    return NextResponse.json({
      success: true,
      data: result,
      stats,
    });
  } catch (error) {
    console.error('获取解读列表失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { documentName, documentUrl, documentExt, documentSize, documentMd5, documentPageCount, projectId } = body;

    // 参数验证
    if (!documentName || !documentUrl || !documentExt || !documentMd5) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证文件格式
    const validExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
    if (!validExts.includes(documentExt)) {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });
    }

    const interpretationId = await createInterpretation({
      documentName,
      documentUrl,
      documentExt,
      documentSize,
      documentMd5,
      documentPageCount,
      uploaderId: user.userId,
      projectId,
    });

    return NextResponse.json({
      success: true,
      data: { id: interpretationId },
      message: '创建成功',
    });
  } catch (error) {
    console.error('创建解读记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}

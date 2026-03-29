/**
 * 审核批注 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import {
  createAnnotation,
  getNodeAnnotations,
  resolveAnnotation as _resolveAnnotation,
  dismissAnnotation as _dismissAnnotation,
  getIssueStats,
} from '@/lib/approval/annotation';

// 获取批注列表
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const projectId = searchParams.get('projectId');

    if (nodeId) {
      const annotations = await getNodeAnnotations(parseInt(nodeId));
      return NextResponse.json({ annotations });
    }

    if (projectId) {
      const stats = await getIssueStats(parseInt(projectId));
      return NextResponse.json({ stats });
    }

    return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  } catch (error) {
    console.error('获取批注失败:', error);
    return NextResponse.json({ error: '获取批注失败' }, { status: 500 });
  }
}

// 创建批注
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const annotation = await createAnnotation(authResult.user!.id, body);

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error('创建批注失败:', error);
    return NextResponse.json({ error: '创建批注失败' }, { status: 500 });
  }
}

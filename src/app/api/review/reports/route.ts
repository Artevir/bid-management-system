/**
 * 审校报告API
 * GET: 获取报告列表
 * POST: 生成新报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReports, generateReport } from '@/lib/review/report';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.cookies.get('accessToken')?.value;
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    // 获取文档ID
    const { searchParams } = new URL(request.url);
    const documentId = parseInt(searchParams.get('documentId') || '0');

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    // 获取报告列表
    const reports = await getReports(documentId);

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取报告列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.cookies.get('accessToken')?.value;
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    // 解析请求体
    const body = await request.json();
    const { documentId, type, title, reviewScope } = body;

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    // 获取自定义请求头
    const customHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (key.startsWith('x-') || key === 'authorization') {
        customHeaders[key] = value;
      }
    });

    // 生成报告
    const report = await generateReport(
      {
        documentId,
        type: type || 'full',
        title,
        reviewScope,
        customHeaders,
      },
      payload.userId
    );

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Generate report error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成报告失败' },
      { status: 500 }
    );
  }
}

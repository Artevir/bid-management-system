/**
 * 单个审校报告API
 * GET: 获取报告详情
 * DELETE: 删除报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReport, deleteReport, updateReportStatus } from '@/lib/review/report';
import { verifyAccessToken } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const reportId = parseInt(id);

    if (!reportId) {
      return NextResponse.json({ error: '无效的报告ID' }, { status: 400 });
    }

    // 获取报告详情
    const report = await getReport(reportId);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Get report error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取报告详情失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const reportId = parseInt(id);

    if (!reportId) {
      return NextResponse.json({ error: '无效的报告ID' }, { status: 400 });
    }

    // 删除报告
    await deleteReport(reportId);

    return NextResponse.json({
      success: true,
      message: '报告已删除',
    });
  } catch (error) {
    console.error('Delete report error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除报告失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const reportId = parseInt(id);

    if (!reportId) {
      return NextResponse.json({ error: '无效的报告ID' }, { status: 400 });
    }

    // 解析请求体
    const body = await request.json();
    const { status } = body;

    if (!status || !['draft', 'published', 'archived'].includes(status)) {
      return NextResponse.json({ error: '无效的状态' }, { status: 400 });
    }

    // 更新报告状态
    await updateReportStatus(reportId, status);

    return NextResponse.json({
      success: true,
      message: '报告状态已更新',
    });
  } catch (error) {
    console.error('Update report error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新报告失败' },
      { status: 500 }
    );
  }
}

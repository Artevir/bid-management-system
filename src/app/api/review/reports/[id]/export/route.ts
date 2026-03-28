/**
 * 审校报告导出API
 * GET: 导出报告为指定格式
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportReportAsHtml, exportReportAsMarkdown, getReport } from '@/lib/review/report';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { db } from '@/db';
import { reviewReports } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'html';

    if (!reportId) {
      return NextResponse.json({ error: '无效的报告ID' }, { status: 400 });
    }

    // 导出报告
    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'html':
        content = await exportReportAsHtml(reportId);
        mimeType = 'text/html';
        extension = 'html';
        break;
      case 'markdown':
        content = await exportReportAsMarkdown(reportId);
        mimeType = 'text/markdown';
        extension = 'md';
        break;
      case 'pdf':
        // PDF导出暂时返回HTML，前端可打印为PDF
        content = await exportReportAsHtml(reportId);
        mimeType = 'text/html';
        extension = 'html';
        break;
      default:
        return NextResponse.json({ error: '不支持的导出格式' }, { status: 400 });
    }

    // 更新导出信息
    await db
      .update(reviewReports)
      .set({
        exportedAt: new Date(),
        exportedBy: payload.userId,
        exportedFormat: format,
        updatedAt: new Date(),
      })
      .where(eq(reviewReports.id, reportId));

    // 获取报告信息用于文件名
    const report = await getReport(reportId);
    const filename = `${report.reportNo}.${extension}`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': `${mimeType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Export report error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出报告失败' },
      { status: 500 }
    );
  }
}

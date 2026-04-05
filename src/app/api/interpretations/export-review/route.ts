/**
 * 导出审核结果API
 * GET: 导出审核结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { db } from '@/db';
import { bidDocumentInterpretations, users, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';
    const status = searchParams.get('status') || 'all';
    const includeReviewInfo = searchParams.get('includeReviewInfo') === 'true';

    // 构建查询条件
    const conditions = [eq(bidDocumentInterpretations.status, 'completed')];
    
    if (status !== 'all') {
      if (status === 'pending') {
        conditions.push(eq(bidDocumentInterpretations.reviewStatus, 'pending'));
      } else if (status === 'approved') {
        conditions.push(eq(bidDocumentInterpretations.reviewStatus, 'approved'));
      } else if (status === 'rejected') {
        conditions.push(eq(bidDocumentInterpretations.reviewStatus, 'rejected'));
      }
    }

    // 获取数据
    const interpretations = await db
      .select({
        interpretation: bidDocumentInterpretations,
        reviewerName: users.name,
      })
      .from(bidDocumentInterpretations)
      .leftJoin(users, eq(bidDocumentInterpretations.reviewerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(bidDocumentInterpretations.createdAt));

    // 准备导出数据
    const exportData = interpretations.map(item => {
      const interp = item.interpretation;
      const data: Record<string, unknown> = {
        '文件名称': interp.documentName,
        '项目名称': interp.projectName || '',
        '项目编号': interp.projectCode || '',
        '招标单位': interp.tenderOrganization || '',
        '招标代理': interp.tenderAgent || '',
        '解析状态': interp.status,
        '提取精度': interp.extractAccuracy ? `${interp.extractAccuracy}%` : '-',
      };

      if (includeReviewInfo) {
        data['审核状态'] = interp.reviewStatus === 'approved' ? '已通过' : interp.reviewStatus === 'rejected' ? '已驳回' : '待审核';
        data['审核人'] = item.reviewerName || '';
        data['审核时间'] = interp.reviewedAt ? new Date(interp.reviewedAt).toLocaleString('zh-CN') : '';
        data['审核准确率'] = interp.reviewAccuracy ? `${interp.reviewAccuracy}%` : '';
        data['审核意见'] = interp.reviewComment || '';
      }

      return data;
    });

    // 根据格式导出
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: exportData,
        message: `共导出 ${exportData.length} 条记录`,
      });
    }

    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=interpretation_review_${Date.now()}.csv`,
        },
      });
    }

    // 默认 Excel
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '审核结果');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 记录导出日志
    await db.insert(auditLogs).values({
      userId: user.userId,
      username: user.username,
      action: 'export',
      resource: 'interpretation_review',
      resourceCode: `export_${Date.now()}`,
      description: `导出解读审核结果，格式：${format}，记录数：${exportData.length}`,
      requestPath: '/api/interpretations/export-review',
      requestMethod: 'GET',
      responseStatus: 200,
      duration: 0,
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=interpretation_review_${Date.now()}.xlsx`,
      },
    });
  } catch (error) {
    console.error('导出审核结果失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 }
    );
  }
}

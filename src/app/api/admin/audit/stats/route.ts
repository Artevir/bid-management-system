/**
 * 审计日志统计 API
 */

import { NextRequest, NextResponse } from 'next/server';
import AuditLogService from '@/lib/audit/audit-service';
import { withPermission as _withPermission, PERMISSIONS as _PERMISSIONS } from '@/lib/auth/rbac-middleware';

// ============================================
// GET - 获取审计日志统计信息
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    let startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    let endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;

    // 如果没有指定日期范围，默认统计最近30天
    if (!startDate && !endDate) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = thirtyDaysAgo;
      endDate = now;
    }

    const stats = await AuditLogService.getStats({ startDate, endDate });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Audit API] 获取统计信息失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取统计信息失败',
    }, { status: 500 });
  }
}

// ============================================
// POST - 删除旧日志（数据归档）
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { beforeDate } = body;

    if (!beforeDate) {
      return NextResponse.json({
        success: false,
        error: '缺少 beforeDate 参数',
      }, { status: 400 });
    }

    const deletedCount = await AuditLogService.deleteOldLogs(new Date(beforeDate));

    return NextResponse.json({
      success: true,
      data: { deletedCount },
      message: `已删除 ${deletedCount} 条旧日志`,
    });
  } catch (error) {
    console.error('[Audit API] 删除旧日志失败:', error);
    return NextResponse.json({
      success: false,
      error: '删除旧日志失败',
    }, { status: 500 });
  }
}

/**
 * 保证金管理API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createGuarantee,
  getGuarantees,
  getGuaranteeById,
  updateGuarantee,
  deleteGuarantee,
  markAsPaid,
  markAsReturned,
  markAsForfeited,
  getPendingGuarantees,
  getExpiringGuarantees,
  getGuaranteeStatistics,
  assignGuarantee,
} from '@/lib/guarantee/service';

// GET /api/guarantees - 获取保证金列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const returnStatus = searchParams.get('returnStatus') || undefined;
    const assigneeId = searchParams.get('assigneeId') ? parseInt(searchParams.get('assigneeId')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 特殊路由处理
    const path = req.nextUrl.pathname;
    if (path.endsWith('/pending')) {
      const guarantees = await getPendingGuarantees();
      return NextResponse.json(guarantees);
    }
    if (path.endsWith('/expiring')) {
      const days = parseInt(searchParams.get('days') || '30');
      const guarantees = await getExpiringGuarantees(days);
      return NextResponse.json(guarantees);
    }
    if (path.endsWith('/statistics')) {
      const stats = await getGuaranteeStatistics(projectId);
      return NextResponse.json(stats);
    }

    const result = await getGuarantees({
      projectId,
      status,
      type,
      returnStatus,
      assigneeId,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取保证金列表失败:', error);
    return NextResponse.json({ error: '获取保证金列表失败' }, { status: 500 });
  }
}

// POST /api/guarantees - 创建保证金记录
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const guarantee = await createGuarantee({
      projectId: body.projectId,
      type: body.type,
      amount: body.amount,
      currency: body.currency || 'CNY',
      guaranteeNumber: body.guaranteeNumber,
      issuingBank: body.issuingBank,
      guaranteeValidFrom: body.guaranteeValidFrom ? new Date(body.guaranteeValidFrom) : null,
      guaranteeValidTo: body.guaranteeValidTo ? new Date(body.guaranteeValidTo) : null,
      guaranteeFile: body.guaranteeFile,
      notes: body.notes,
      // 时间管理
      plannedDate: body.plannedDate ? new Date(body.plannedDate) : null,
      // 任务指派
      assigneeId: body.assigneeId,
      assigneeName: body.assigneeName,
      priority: body.priority || 'medium',
      status: 'pending',
      returnStatus: 'not_applied',
      createdBy: session.user.id,
    });

    return NextResponse.json(guarantee);
  } catch (error) {
    console.error('创建保证金记录失败:', error);
    return NextResponse.json({ error: '创建保证金记录失败' }, { status: 500 });
  }
}

/**
 * 单个保证金API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getGuaranteeById,
  updateGuarantee,
  deleteGuarantee,
  assignGuarantee,
} from '@/lib/guarantee/service';

// GET /api/guarantees/[id] - 获取保证金详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const guarantee = await getGuaranteeById(id);

    if (!guarantee) {
      return NextResponse.json({ error: '保证金记录不存在' }, { status: 404 });
    }

    return NextResponse.json(guarantee);
  } catch (error) {
    console.error('获取保证金详情失败:', error);
    return NextResponse.json({ error: '获取保证金详情失败' }, { status: 500 });
  }
}

// PATCH /api/guarantees/[id] - 更新保证金记录
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await req.json();

    // 如果有任务指派信息，使用专门的指派方法
    if (body.assigneeId !== undefined) {
      const guarantee = await assignGuarantee(id, {
        assigneeId: body.assigneeId,
        assigneeName: body.assigneeName || '',
        priority: body.priority,
        plannedDate: body.plannedDate ? new Date(body.plannedDate) : undefined,
      });
      return NextResponse.json(guarantee);
    }

    const guarantee = await updateGuarantee(id, {
      type: body.type,
      amount: body.amount,
      guaranteeNumber: body.guaranteeNumber,
      issuingBank: body.issuingBank,
      guaranteeValidFrom: body.guaranteeValidFrom ? new Date(body.guaranteeValidFrom) : undefined,
      guaranteeValidTo: body.guaranteeValidTo ? new Date(body.guaranteeValidTo) : undefined,
      guaranteeFile: body.guaranteeFile,
      notes: body.notes,
      plannedDate: body.plannedDate ? new Date(body.plannedDate) : undefined,
      priority: body.priority,
    });

    return NextResponse.json(guarantee);
  } catch (error) {
    console.error('更新保证金记录失败:', error);
    return NextResponse.json({ error: '更新保证金记录失败' }, { status: 500 });
  }
}

// DELETE /api/guarantees/[id] - 删除保证金记录
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    await deleteGuarantee(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除保证金记录失败:', error);
    return NextResponse.json({ error: '删除保证金记录失败' }, { status: 500 });
  }
}

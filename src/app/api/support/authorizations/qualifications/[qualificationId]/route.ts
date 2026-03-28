/**
 * 单个资质材料API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  updateQualification,
  deleteQualification,
} from '@/lib/authorization/service';

// PUT - 更新资质材料
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { qualificationId } = await params;
    const id = parseInt(qualificationId);
    const body = await req.json();

    const qualification = await updateQualification(id, {
      category: body.category,
      customCategoryName: body.customCategoryName,
      isProvided: body.isProvided,
      notes: body.notes,
      fileId: body.fileId,
      fileUrl: body.fileUrl,
      submitType: body.submitType,
      hasPerformance: body.hasPerformance,
      performanceType: body.performanceType,
      performanceNotes: body.performanceNotes,
      performanceYear: body.performanceYear ? new Date(body.performanceYear) : undefined,
      validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
      validTo: body.validTo ? new Date(body.validTo) : undefined,
      supplyCycle: body.supplyCycle,
      supplyCapacityNotes: body.supplyCapacityNotes,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json(qualification);
  } catch (error) {
    console.error('更新资质材料失败:', error);
    return NextResponse.json({ error: '更新资质材料失败' }, { status: 500 });
  }
}

// DELETE - 删除资质材料
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { qualificationId } = await params;
    const id = parseInt(qualificationId);

    await deleteQualification(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除资质材料失败:', error);
    return NextResponse.json({ error: '删除资质材料失败' }, { status: 500 });
  }
}

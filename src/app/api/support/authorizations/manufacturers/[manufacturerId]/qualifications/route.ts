/**
 * 资质材料API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getQualifications,
  createQualification,
  updateQualification as _updateQualification,
  deleteQualification as _deleteQualification,
} from '@/lib/authorization/service';

// GET - 获取资质材料列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { manufacturerId } = await params;
    const id = parseInt(manufacturerId);
    const qualifications = await getQualifications(id);

    return NextResponse.json(qualifications);
  } catch (error) {
    console.error('获取资质材料列表失败:', error);
    return NextResponse.json({ error: '获取资质材料列表失败' }, { status: 500 });
  }
}

// POST - 创建资质材料
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { manufacturerId } = await params;
    const id = parseInt(manufacturerId);
    const body = await req.json();

    const qualification = await createQualification({
      manufacturerId: id,
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
    console.error('创建资质材料失败:', error);
    return NextResponse.json({ error: '创建资质材料失败' }, { status: 500 });
  }
}

/**
 * 单个材料API路由
 * PUT /api/support/partner-applications/[id]/materials/[materialId] - 更新材料
 * DELETE /api/support/partner-applications/[id]/materials/[materialId] - 删除材料
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  updatePartnerMaterial,
  deletePartnerMaterial,
} from '@/lib/partner-application/service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { materialId } = await params;
    const id = parseInt(materialId);
    const body = await req.json();

    const material = await updatePartnerMaterial(id, {
      category: body.category,
      materialName: body.materialName,
      isProvided: body.isProvided,
      submitType: body.submitType,
      notes: body.notes,
      fileId: body.fileId,
      fileUrl: body.fileUrl,
      isConfirmed: body.isConfirmed,
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error('更新友司材料失败:', error);
    return NextResponse.json({ error: '更新友司材料失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { materialId } = await params;
    const id = parseInt(materialId);

    await deletePartnerMaterial(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除友司材料失败:', error);
    return NextResponse.json({ error: '删除友司材料失败' }, { status: 500 });
  }
}

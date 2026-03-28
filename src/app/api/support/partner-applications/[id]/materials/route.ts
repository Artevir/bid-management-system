/**
 * 友司材料API路由
 * GET /api/support/partner-applications/[id]/materials - 获取材料列表
 * POST /api/support/partner-applications/[id]/materials - 创建材料
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getPartnerMaterials,
  createPartnerMaterial,
} from '@/lib/partner-application/service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);

    const materials = await getPartnerMaterials(applicationId);
    return NextResponse.json(materials);
  } catch (error) {
    console.error('获取友司材料失败:', error);
    return NextResponse.json({ error: '获取友司材料失败' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const applicationId = parseInt(id);
    const body = await req.json();

    const material = await createPartnerMaterial({
      applicationId,
      category: body.category,
      materialName: body.materialName,
      isProvided: body.isProvided,
      submitType: body.submitType,
      notes: body.notes,
      fileId: body.fileId,
      fileUrl: body.fileUrl,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json(material);
  } catch (error) {
    console.error('创建友司材料失败:', error);
    return NextResponse.json({ error: '创建友司材料失败' }, { status: 500 });
  }
}

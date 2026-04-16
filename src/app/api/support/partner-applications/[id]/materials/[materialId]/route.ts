/**
 * 单个材料API路由
 * PUT /api/support/partner-applications/[id]/materials/[materialId] - 更新材料
 * DELETE /api/support/partner-applications/[id]/materials/[materialId] - 删除材料
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { updatePartnerMaterial, deletePartnerMaterial } from '@/lib/partner-application/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  assertPartnerMaterialBelongs,
  canAccessPartnerApplication,
} from '@/lib/support/application-access';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const materialId = parseIdFromParams(p, 'materialId', '材料');

      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertPartnerMaterialBelongs(applicationId, materialId);
      if (!belongs) {
        return NextResponse.json({ error: '材料不属于该申请' }, { status: 400 });
      }

      const body = await request.json();

      const material = await updatePartnerMaterial(materialId, {
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
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const materialId = parseIdFromParams(p, 'materialId', '材料');

      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertPartnerMaterialBelongs(applicationId, materialId);
      if (!belongs) {
        return NextResponse.json({ error: '材料不属于该申请' }, { status: 400 });
      }

      await deletePartnerMaterial(materialId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除友司材料失败:', error);
      return NextResponse.json({ error: '删除友司材料失败' }, { status: 500 });
    }
  });
}

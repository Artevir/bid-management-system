/**
 * 友司材料API路由
 * GET /api/support/partner-applications/[id]/materials - 获取材料列表
 * POST /api/support/partner-applications/[id]/materials - 创建材料
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getPartnerMaterials, createPartnerMaterial } from '@/lib/partner-application/service';
import { parseIdFromParams } from '@/lib/api/validators';
import { canAccessPartnerApplication } from '@/lib/support/application-access';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const permission = await canAccessPartnerApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const materials = await getPartnerMaterials(applicationId);
      return NextResponse.json(materials);
    } catch (error) {
      console.error('获取友司材料失败:', error);
      return NextResponse.json({ error: '获取友司材料失败' }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '友司支持申请');
      const permission = await canAccessPartnerApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '友司支持申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const body = await request.json();

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
  });
}

/**
 * 单个资质材料API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { updateQualification, deleteQualification } from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  canAccessAuthorizationApplication,
  getAuthorizationQualificationApplicationId,
} from '@/lib/support/application-access';

// PUT - 更新资质材料
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const id = parseIdFromParams(p, 'qualificationId', '资质材料');
      const applicationId = await getAuthorizationQualificationApplicationId(id);
      if (!applicationId) {
        return NextResponse.json({ error: '资质材料不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }

      const body = await request.json();

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
  });
}

// DELETE - 删除资质材料
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ qualificationId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const id = parseIdFromParams(p, 'qualificationId', '资质材料');
      const applicationId = await getAuthorizationQualificationApplicationId(id);
      if (!applicationId) {
        return NextResponse.json({ error: '资质材料不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }

      await deleteQualification(id);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除资质材料失败:', error);
      return NextResponse.json({ error: '删除资质材料失败' }, { status: 500 });
    }
  });
}

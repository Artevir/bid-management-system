/**
 * 资质材料API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getQualifications,
  createQualification,
  updateQualification as _updateQualification,
  deleteQualification as _deleteQualification,
} from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  canAccessAuthorizationApplication,
  getAuthorizationManufacturerApplicationId,
} from '@/lib/support/application-access';

// GET - 获取资质材料列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const manufacturerId = parseIdFromParams(p, 'manufacturerId', '厂家');
      const applicationId = await getAuthorizationManufacturerApplicationId(manufacturerId);
      if (!applicationId) {
        return NextResponse.json({ error: '厂家不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const qualifications = await getQualifications(manufacturerId);
      return NextResponse.json(qualifications);
    } catch (error) {
      console.error('获取资质材料列表失败:', error);
      return NextResponse.json({ error: '获取资质材料列表失败' }, { status: 500 });
    }
  });
}

// POST - 创建资质材料
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const manufacturerId = parseIdFromParams(p, 'manufacturerId', '厂家');
      const applicationId = await getAuthorizationManufacturerApplicationId(manufacturerId);
      if (!applicationId) {
        return NextResponse.json({ error: '厂家不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }

      const body = await request.json();

      const qualification = await createQualification({
        manufacturerId,
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
  });
}

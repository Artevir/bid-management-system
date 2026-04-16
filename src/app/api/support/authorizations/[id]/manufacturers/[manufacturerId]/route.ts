/**
 * 单个厂家API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { updateManufacturer, deleteManufacturer } from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  assertAuthorizationManufacturerBelongs,
  canAccessAuthorizationApplication,
} from '@/lib/support/application-access';

// PUT - 更新厂家
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; manufacturerId: string }> }
) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const manufacturerId = parseIdFromParams(p, 'manufacturerId', '厂家');

      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertAuthorizationManufacturerBelongs(applicationId, manufacturerId);
      if (!belongs) {
        return NextResponse.json({ error: '厂家不属于该申请' }, { status: 400 });
      }

      const body = await request.json();

      const manufacturer = await updateManufacturer(manufacturerId, {
        type: body.type,
        companyId: body.companyId,
        manufacturerName: body.manufacturerName,
        manufacturerAddress: body.manufacturerAddress,
        contactPerson: body.contactPerson,
        contactPhone: body.contactPhone,
        productName: body.productName,
        productConfig: body.productConfig,
        deviationType: body.deviationType,
        deviationNotes: body.deviationNotes,
        sortOrder: body.sortOrder,
      });

      return NextResponse.json(manufacturer);
    } catch (error) {
      console.error('更新厂家失败:', error);
      return NextResponse.json({ error: '更新厂家失败' }, { status: 500 });
    }
  });
}

// DELETE - 删除厂家
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; manufacturerId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const manufacturerId = parseIdFromParams(p, 'manufacturerId', '厂家');

      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const belongs = await assertAuthorizationManufacturerBelongs(applicationId, manufacturerId);
      if (!belongs) {
        return NextResponse.json({ error: '厂家不属于该申请' }, { status: 400 });
      }

      await deleteManufacturer(manufacturerId);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除厂家失败:', error);
      return NextResponse.json({ error: '删除厂家失败' }, { status: 500 });
    }
  });
}

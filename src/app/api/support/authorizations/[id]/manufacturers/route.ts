/**
 * 授权厂家API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getManufacturers,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer as _deleteManufacturer,
} from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  assertAuthorizationManufacturerBelongs,
  canAccessAuthorizationApplication,
} from '@/lib/support/application-access';

// GET - 获取厂家列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const manufacturers = await getManufacturers(applicationId);
      return NextResponse.json(manufacturers);
    } catch (error) {
      console.error('获取厂家列表失败:', error);
      return NextResponse.json({ error: '获取厂家列表失败' }, { status: 500 });
    }
  });
}

// POST - 创建厂家
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }
      const body = await request.json();

      const manufacturer = await createManufacturer({
        applicationId,
        type: body.type || 'partner',
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
      console.error('创建厂家失败:', error);
      return NextResponse.json({ error: '创建厂家失败' }, { status: 500 });
    }
  });
}

// PUT - 批量更新厂家排序
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const applicationId = parseIdFromParams(p, 'id', '授权申请');
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }

      const body = await request.json();

      if (Array.isArray(body.manufacturers)) {
        for (const m of body.manufacturers) {
          const manufacturerId = Number.parseInt(String(m.id), 10);
          if (!Number.isInteger(manufacturerId) || manufacturerId <= 0) {
            return NextResponse.json({ error: '无效的厂家ID' }, { status: 400 });
          }
          const belongs = await assertAuthorizationManufacturerBelongs(
            applicationId,
            manufacturerId
          );
          if (!belongs) {
            return NextResponse.json({ error: '厂家不属于该申请' }, { status: 400 });
          }
        }
        const updates = body.manufacturers.map((m: any) =>
          updateManufacturer(Number.parseInt(String(m.id), 10), { sortOrder: m.sortOrder })
        );
        await Promise.all(updates);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('更新厂家失败:', error);
      return NextResponse.json({ error: '更新厂家失败' }, { status: 500 });
    }
  });
}

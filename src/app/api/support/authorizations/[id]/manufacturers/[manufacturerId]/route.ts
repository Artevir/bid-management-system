/**
 * 单个厂家API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  updateManufacturer,
  deleteManufacturer,
} from '@/lib/authorization/service';

// PUT - 更新厂家
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; manufacturerId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { manufacturerId } = await params;
    const id = parseInt(manufacturerId);
    const body = await req.json();

    const manufacturer = await updateManufacturer(id, {
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
}

// DELETE - 删除厂家
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; manufacturerId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { manufacturerId } = await params;
    const id = parseInt(manufacturerId);

    await deleteManufacturer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除厂家失败:', error);
    return NextResponse.json({ error: '删除厂家失败' }, { status: 500 });
  }
}

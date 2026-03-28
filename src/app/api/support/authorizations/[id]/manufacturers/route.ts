/**
 * 授权厂家API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getManufacturers,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
} from '@/lib/authorization/service';

// GET - 获取厂家列表
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
    const manufacturers = await getManufacturers(applicationId);

    return NextResponse.json(manufacturers);
  } catch (error) {
    console.error('获取厂家列表失败:', error);
    return NextResponse.json({ error: '获取厂家列表失败' }, { status: 500 });
  }
}

// POST - 创建厂家
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
}

// PUT - 批量更新厂家排序
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    
    if (Array.isArray(body.manufacturers)) {
      const updates = body.manufacturers.map((m: any) => 
        updateManufacturer(m.id, { sortOrder: m.sortOrder })
      );
      await Promise.all(updates);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新厂家失败:', error);
    return NextResponse.json({ error: '更新厂家失败' }, { status: 500 });
  }
}

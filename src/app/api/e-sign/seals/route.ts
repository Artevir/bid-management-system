/**
 * 电子印章API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createSeal,
  getSeals,
  getSealById,
  updateSeal,
  deleteSeal,
} from '@/lib/e-sign/service';

// GET /api/e-sign/seals - 获取电子印章列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    const filters = {
      configId: searchParams.get('configId') ? parseInt(searchParams.get('configId')!) : undefined,
      companyId: searchParams.get('companyId') ? parseInt(searchParams.get('companyId')!) : undefined,
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
    };

    const seals = await getSeals(filters);

    return NextResponse.json(seals);
  } catch (error) {
    console.error('获取电子印章列表失败:', error);
    return NextResponse.json({ error: '获取电子印章列表失败' }, { status: 500 });
  }
}

// POST /api/e-sign/seals - 创建电子印章
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const seal = await createSeal({
      name: body.name,
      type: body.type,
      configId: body.configId,
      companyId: body.companyId,
      externalSealId: body.externalSealId || null,
      sealImage: body.sealImage || null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
      status: body.status || 'pending',
      usageScope: body.usageScope || null,
      authorizedUsers: body.authorizedUsers || null,
      createdBy: session.user.id,
    });

    return NextResponse.json(seal);
  } catch (error) {
    console.error('创建电子印章失败:', error);
    return NextResponse.json({ error: '创建电子印章失败' }, { status: 500 });
  }
}

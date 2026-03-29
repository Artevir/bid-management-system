/**
 * 电子签章配置API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  createSealConfig,
  getSealConfigs,
  getSealConfigById as _getSealConfigById,
  updateSealConfig as _updateSealConfig,
  deleteSealConfig as _deleteSealConfig,
  SEAL_PROVIDERS,
} from '@/lib/e-sign/service';

// GET /api/e-sign/configs - 获取签章配置列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    
    // 特殊路由：获取服务商信息
    const path = req.nextUrl.pathname;
    if (path.endsWith('/providers')) {
      return NextResponse.json(SEAL_PROVIDERS);
    }

    const filters = {
      provider: searchParams.get('provider') || undefined,
      companyId: searchParams.get('companyId') ? parseInt(searchParams.get('companyId')!) : undefined,
      isActive: searchParams.get('isActive') === 'true' ? true : 
                searchParams.get('isActive') === 'false' ? false : undefined,
    };

    const configs = await getSealConfigs(filters);

    return NextResponse.json(configs);
  } catch (error) {
    console.error('获取签章配置列表失败:', error);
    return NextResponse.json({ error: '获取签章配置列表失败' }, { status: 500 });
  }
}

// POST /api/e-sign/configs - 创建签章配置
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    const config = await createSealConfig({
      name: body.name,
      provider: body.provider,
      apiUrl: body.apiUrl,
      appId: body.appId,
      appSecret: body.appSecret,
      companyId: body.companyId,
      enterpriseId: body.enterpriseId || null,
      enterpriseName: body.enterpriseName || null,
      creditCode: body.creditCode || null,
      config: body.config || null,
      isActive: body.isActive ?? true,
      isDefault: body.isDefault ?? false,
      createdBy: session.user.id,
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('创建签章配置失败:', error);
    return NextResponse.json({ error: '创建签章配置失败' }, { status: 500 });
  }
}

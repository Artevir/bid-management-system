/**
 * 租户管理API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { TenantService, TenantType } from '@/lib/tenant/tenant-service';

const tenantService = new TenantService();

// ============================================
// POST - 创建租户
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, domain } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (!Object.values(TenantType).includes(type)) {
      return NextResponse.json(
        { error: '无效的租户类型' },
        { status: 400 }
      );
    }

    const tenant = await tenantService.createTenant(name, type, domain);

    return NextResponse.json({
      tenant,
      message: '租户创建成功',
    });
  } catch (error: any) {
    console.error('Create tenant error:', error);
    return NextResponse.json(
      { error: error.message || '创建租户失败' },
      { status: 500 }
    );
  }
}

// ============================================
// GET - 获取租户列表
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const domain = searchParams.get('domain');

  try {
    if (tenantId) {
      const tenant = tenantService.getTenant(tenantId);
      if (!tenant) {
        return NextResponse.json(
          { error: '租户不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json({ tenant });
    }

    if (domain) {
      const tenant = tenantService.getTenantByDomain(domain);
      if (!tenant) {
        return NextResponse.json(
          { error: '租户不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json({ tenant });
    }

    // 返回所有租户（在实际应用中应该添加权限验证）
    return NextResponse.json({
      message: '请提供tenantId或domain参数',
    });
  } catch (error: any) {
    console.error('Get tenant error:', error);
    return NextResponse.json(
      { error: error.message || '获取租户失败' },
      { status: 500 }
    );
  }
}

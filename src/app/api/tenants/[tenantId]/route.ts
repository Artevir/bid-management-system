/**
 * 租户详情操作API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { TenantService } from '@/lib/tenant/tenant-service';

const tenantService = new TenantService();

// ============================================
// GET - 获取租户详情
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const tenant = tenantService.getTenant(tenantId);

    if (!tenant) {
      return NextResponse.json(
        { error: '租户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ tenant });
  } catch (error: any) {
    console.error('Get tenant details error:', error);
    return NextResponse.json(
      { error: error.message || '获取租户详情失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - 更新租户
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const body = await request.json();
    const { name, domain, status, config } = body;

    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (status !== undefined) updates.status = status;
    if (config !== undefined) {
      const success = tenantService.updateTenantConfig(tenantId, config);
      if (!success) {
        return NextResponse.json(
          { error: '更新租户配置失败' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length > 0) {
      const success = tenantService.getTenant(tenantId);
      if (!success) {
        return NextResponse.json(
          { error: '租户不存在' },
          { status: 404 }
        );
      }
    }

    const updatedTenant = tenantService.getTenant(tenantId);

    return NextResponse.json({
      tenant: updatedTenant,
      message: '租户更新成功',
    });
  } catch (error: any) {
    console.error('Update tenant error:', error);
    return NextResponse.json(
      { error: error.message || '更新租户失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除租户
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;

    const success = tenantService.suspendTenant(tenantId);

    if (!success) {
      return NextResponse.json(
        { error: '租户不存在或操作失败' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: '租户已暂停',
    });
  } catch (error: any) {
    console.error('Delete tenant error:', error);
    return NextResponse.json(
      { error: error.message || '删除租户失败' },
      { status: 500 }
    );
  }
}

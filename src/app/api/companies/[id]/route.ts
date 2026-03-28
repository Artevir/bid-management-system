/**
 * 公司详情API
 * GET: 获取公司详情
 * PUT: 更新公司信息
 * DELETE: 删除公司
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkCompanyPermission } from '@/lib/auth/resource-permission';
import {
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyStats,
  getFileTypeStats,
  UpdateCompanyData,
} from '@/lib/company/service';

// 获取公司详情
async function getDetail(
  request: NextRequest,
  userId: number,
  companyId: number
): Promise<NextResponse> {
  try {
    // 权限检查：读取公司
    const permissionResult = await checkCompanyPermission(userId, companyId, 'read');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权访问此公司信息' },
        { status: 403 }
      );
    }

    const company = await getCompanyById(companyId, userId);

    if (!company) {
      return NextResponse.json({ error: '公司不存在' }, { status: 404 });
    }

    // 获取文件类型统计
    const fileTypeStats = await getFileTypeStats(companyId);

    // 检查是否请求包含统计信息
    const { searchParams } = new URL(request.url);
    if (searchParams.get('withStats') === 'true') {
      const stats = await getCompanyStats(userId);
      return NextResponse.json({
        data: {
          ...company,
          fileTypeStats,
          stats,
        },
      });
    }

    return NextResponse.json({ data: company });
  } catch (error) {
    console.error('Get company detail error:', error);
    return NextResponse.json({ error: '获取公司详情失败' }, { status: 500 });
  }
}

// 更新公司信息
async function update(
  request: NextRequest,
  userId: number,
  companyId: number
): Promise<NextResponse> {
  try {
    // 权限检查：编辑公司
    const permissionResult = await checkCompanyPermission(userId, companyId, 'edit');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权编辑此公司信息' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 构建更新数据
    const data: UpdateCompanyData = {};

    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: '公司名称不能为空' }, { status: 400 });
      }
      data.name = body.name.trim();
    }

    if (body.creditCode !== undefined) {
      if (!body.creditCode?.trim()) {
        return NextResponse.json({ error: '统一社会信用代码不能为空' }, { status: 400 });
      }
      data.creditCode = body.creditCode.trim();
    }

    if (body.registerAddress !== undefined) {
      if (!body.registerAddress?.trim()) {
        return NextResponse.json({ error: '注册地址不能为空' }, { status: 400 });
      }
      data.registerAddress = body.registerAddress.trim();
    }

    if (body.legalPersonName !== undefined) {
      if (!body.legalPersonName?.trim()) {
        return NextResponse.json({ error: '法定代表人姓名不能为空' }, { status: 400 });
      }
      data.legalPersonName = body.legalPersonName.trim();
    }

    if (body.contactPersonName !== undefined) {
      if (!body.contactPersonName?.trim()) {
        return NextResponse.json({ error: '接口人姓名不能为空' }, { status: 400 });
      }
      data.contactPersonName = body.contactPersonName.trim();
    }

    // 可选字段
    if (body.shortName !== undefined) data.shortName = body.shortName?.trim();
    if (body.officeAddress !== undefined) data.officeAddress = body.officeAddress?.trim();
    if (body.legalPersonIdCard !== undefined) data.legalPersonIdCard = body.legalPersonIdCard?.trim();
    if (body.agentName !== undefined) data.agentName = body.agentName?.trim();
    if (body.agentIdCard !== undefined) data.agentIdCard = body.agentIdCard?.trim();
    if (body.contactPersonDept !== undefined) data.contactPersonDept = body.contactPersonDept?.trim();
    if (body.contactPersonPosition !== undefined) data.contactPersonPosition = body.contactPersonPosition?.trim();
    if (body.contactPersonPhone !== undefined) data.contactPersonPhone = body.contactPersonPhone?.trim();
    if (body.contactPersonEmail !== undefined) data.contactPersonEmail = body.contactPersonEmail?.trim();
    if (body.contactPersonWechat !== undefined) data.contactPersonWechat = body.contactPersonWechat?.trim();
    if (body.industry !== undefined) data.industry = body.industry;
    if (body.companyType !== undefined) data.companyType = body.companyType;
    if (body.registeredCapital !== undefined) data.registeredCapital = body.registeredCapital;
    if (body.establishDate !== undefined) data.establishDate = body.establishDate ? new Date(body.establishDate) : undefined;
    if (body.businessScope !== undefined) data.businessScope = body.businessScope;
    if (body.bankName !== undefined) data.bankName = body.bankName;
    if (body.bankAccount !== undefined) data.bankAccount = body.bankAccount;
    if (body.taxpayerType !== undefined) data.taxpayerType = body.taxpayerType;
    if (body.description !== undefined) data.description = body.description;
    if (body.remarks !== undefined) data.remarks = body.remarks;
    if (body.isDefault !== undefined) data.isDefault = body.isDefault;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    await updateCompany(companyId, data, userId);

    return NextResponse.json({
      success: true,
      message: '公司信息更新成功',
    });
  } catch (error) {
    console.error('Update company error:', error);
    const message = error instanceof Error ? error.message : '更新公司信息失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// 删除公司
async function remove(
  request: NextRequest,
  userId: number,
  companyId: number
): Promise<NextResponse> {
  try {
    // 权限检查：删除公司
    const permissionResult = await checkCompanyPermission(userId, companyId, 'delete');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权删除此公司' },
        { status: 403 }
      );
    }

    // 检查是否请求物理删除
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    const confirmed = searchParams.get('confirmed') === 'true';

    if (permanent && confirmed) {
      // 物理删除
      await deleteCompany(companyId, userId);
      return NextResponse.json({
        success: true,
        message: '公司已永久删除',
      });
    }

    // 默认：移至回收站
    const { moveToRecycleBin } = await import('@/lib/recycle-bin/service');
    const result = await moveToRecycleBin({
      resourceType: 'company',
      resourceId: companyId,
      deletedBy: userId,
    });

    if (!result.success) {
      // 如果移至回收站失败，返回错误
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '公司已移至回收站',
      data: { recycleBinId: result.recycleBinId },
    });
  } catch (error) {
    console.error('Delete company error:', error);
    const message = error instanceof Error ? error.message : '删除公司失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const companyId = parseInt(id);
  
  if (isNaN(companyId)) {
    return NextResponse.json({ error: '无效的公司ID' }, { status: 400 });
  }
  
  return withAuth(request, (req, userId) => getDetail(req, userId, companyId));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const companyId = parseInt(id);
  
  if (isNaN(companyId)) {
    return NextResponse.json({ error: '无效的公司ID' }, { status: 400 });
  }
  
  return withAuth(request, (req, userId) => update(req, userId, companyId));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const companyId = parseInt(id);
  
  if (isNaN(companyId)) {
    return NextResponse.json({ error: '无效的公司ID' }, { status: 400 });
  }
  
  return withAuth(request, (req, userId) => remove(req, userId, companyId));
}

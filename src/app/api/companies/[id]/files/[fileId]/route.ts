/**
 * 公司文件详情API
 * GET: 获取文件详情
 * PUT: 更新文件信息
 * DELETE: 删除文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkCompanyFilePermission } from '@/lib/auth/resource-permission';
import {
  getCompanyById,
  getCompanyFileById,
  deleteCompanyFile,
  updateCompanyFile,
} from '@/lib/company/service';

// 获取文件详情
async function getDetail(
  request: NextRequest,
  userId: number,
  companyId: number,
  fileId: number
): Promise<NextResponse> {
  try {
    // 权限检查：读取公司文件
    const permissionResult = await checkCompanyFilePermission(userId, fileId, 'read');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权访问此文件' },
        { status: 403 }
      );
    }

    // 验证公司存在
    const company = await getCompanyById(companyId, userId);
    if (!company) {
      return NextResponse.json({ error: '公司不存在' }, { status: 404 });
    }

    const file = await getCompanyFileById(fileId, companyId);
    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    return NextResponse.json({ data: file });
  } catch (error) {
    console.error('Get company file detail error:', error);
    return NextResponse.json({ error: '获取文件详情失败' }, { status: 500 });
  }
}

// 更新文件信息
async function update(
  request: NextRequest,
  userId: number,
  companyId: number,
  fileId: number
): Promise<NextResponse> {
  try {
    // 权限检查：编辑公司文件
    const permissionResult = await checkCompanyFilePermission(userId, fileId, 'edit');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权编辑此文件' },
        { status: 403 }
      );
    }

    // 验证公司存在
    const company = await getCompanyById(companyId, userId);
    if (!company) {
      return NextResponse.json({ error: '公司不存在' }, { status: 404 });
    }

    const file = await getCompanyFileById(fileId, companyId);
    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, any> = {};

    if (body.fileName !== undefined) data.fileName = body.fileName;
    if (body.description !== undefined) data.description = body.description;
    if (body.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validTo !== undefined) data.validTo = body.validTo ? new Date(body.validTo) : null;

    await updateCompanyFile(fileId, data);

    return NextResponse.json({
      success: true,
      message: '文件信息更新成功',
    });
  } catch (error) {
    console.error('Update company file error:', error);
    const message = error instanceof Error ? error.message : '更新文件信息失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// 删除文件
async function remove(
  request: NextRequest,
  userId: number,
  companyId: number,
  fileId: number
): Promise<NextResponse> {
  try {
    // 权限检查：删除公司文件
    const permissionResult = await checkCompanyFilePermission(userId, fileId, 'delete');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权删除此文件' },
        { status: 403 }
      );
    }

    // 验证公司存在
    const company = await getCompanyById(companyId, userId);
    if (!company) {
      return NextResponse.json({ error: '公司不存在' }, { status: 404 });
    }

    const file = await getCompanyFileById(fileId, companyId);
    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 检查是否请求物理删除
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    const confirmed = searchParams.get('confirmed') === 'true';

    if (permanent && confirmed) {
      // 物理删除
      await deleteCompanyFile(fileId, companyId);
      return NextResponse.json({
        success: true,
        message: '文件已永久删除',
      });
    }

    // 默认：移至回收站
    const { moveToRecycleBin } = await import('@/lib/recycle-bin/service');
    const result = await moveToRecycleBin({
      resourceType: 'company_file',
      resourceId: fileId,
      deletedBy: userId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '文件已移至回收站',
      data: { recycleBinId: result.recycleBinId },
    });
  } catch (error) {
    console.error('Delete company file error:', error);
    const message = error instanceof Error ? error.message : '删除文件失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const companyId = parseInt(id);
  const fId = parseInt(fileId);
  
  if (isNaN(companyId) || isNaN(fId)) {
    return NextResponse.json({ error: '无效的ID' }, { status: 400 });
  }
  
  return withAuth(request, (req, userId) => getDetail(req, userId, companyId, fId));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const companyId = parseInt(id);
  const fId = parseInt(fileId);
  
  if (isNaN(companyId) || isNaN(fId)) {
    return NextResponse.json({ error: '无效的ID' }, { status: 400 });
  }
  
  return withAuth(request, (req, userId) => update(req, userId, companyId, fId));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const companyId = parseInt(id);
  const fId = parseInt(fileId);
  
  if (isNaN(companyId) || isNaN(fId)) {
    return NextResponse.json({ error: '无效的ID' }, { status: 400 });
  }
  
  return withAuth(request, (req, userId) => remove(req, userId, companyId, fId));
}

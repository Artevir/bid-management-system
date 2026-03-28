/**
 * 公司文件管理API
 * GET: 获取公司文件列表
 * POST: 上传公司文件
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkCompanyPermission, checkCompanyFilePermission } from '@/lib/auth/resource-permission';
import {
  getCompanyFileList,
  createCompanyFile,
  getCompanyById,
  CompanyFileListParams,
  CreateCompanyFileData,
} from '@/lib/company/service';

// 文件类型映射
const FILE_TYPE_LABELS: Record<string, string> = {
  business_license: '营业执照',
  business_certificate: '商务资质证书',
  personnel_certificate: '人员资质',
  performance_scan: '业绩扫描件',
  contract: '合同文件',
  financial_statement: '财务报表',
  tax_certificate: '税务证明',
  other: '其他文件',
};

// 获取公司文件列表
async function getList(
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

    // 验证公司存在
    const company = await getCompanyById(companyId, userId);
    if (!company) {
      return NextResponse.json({ error: '公司不存在' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);

    const params: CompanyFileListParams = {
      companyId,
      fileType: searchParams.get('fileType') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      isActive: searchParams.get('isActive') === 'false' ? false : true,
    };

    const files = await getCompanyFileList(params);

    return NextResponse.json({
      data: files,
      total: files.length,
      fileTypeLabels: FILE_TYPE_LABELS,
    });
  } catch (error) {
    console.error('Get company files error:', error);
    return NextResponse.json({ error: '获取公司文件列表失败' }, { status: 500 });
  }
}

// 上传公司文件
async function upload(
  request: NextRequest,
  userId: number,
  companyId: number
): Promise<NextResponse> {
  try {
    // 权限检查：编辑公司（上传文件需要编辑权限）
    const permissionResult = await checkCompanyPermission(userId, companyId, 'edit');
    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.reason || '无权上传文件到此公司' },
        { status: 403 }
      );
    }

    // 验证公司存在
    const company = await getCompanyById(companyId, userId);
    if (!company) {
      return NextResponse.json({ error: '公司不存在' }, { status: 404 });
    }

    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileType = formData.get('fileType') as string;
    const fileName = formData.get('fileName') as string;
    const description = formData.get('description') as string;
    const validFrom = formData.get('validFrom') as string;
    const validTo = formData.get('validTo') as string;

    // 验证必填字段
    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 });
    }

    if (!fileType || !FILE_TYPE_LABELS[fileType]) {
      return NextResponse.json({ error: '请选择正确的文件类型' }, { status: 400 });
    }

    // 文件大小限制（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过10MB' }, { status: 400 });
    }

    // TODO: 实际项目中需要上传文件到对象存储
    // 这里使用模拟的文件URL
    const fileUrl = `/uploads/companies/${companyId}/${Date.now()}-${file.name}`;
    const fileExt = file.name.split('.').pop() || '';
    const fileSize = formatFileSize(file.size);

    // 创建文件记录
    const data: CreateCompanyFileData = {
      companyId,
      fileName: fileName || file.name.replace(/\.[^/.]+$/, ''),
      fileType: fileType as CreateCompanyFileData['fileType'],
      fileUrl,
      fileSize,
      fileExt,
      description: description || undefined,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined,
    };

    const fileId = await createCompanyFile(data, userId);

    return NextResponse.json(
      {
        success: true,
        message: '文件上传成功',
        data: {
          id: fileId,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload company file error:', error);
    const message = error instanceof Error ? error.message : '文件上传失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  
  return withAuth(request, (req, userId) => getList(req, userId, companyId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const companyId = parseInt(id);
  
  if (isNaN(companyId)) {
    return NextResponse.json({ error: '无效的公司ID' }, { status: 400 });
  }
  
  return withAuth(request, (req, userId) => upload(req, userId, companyId));
}

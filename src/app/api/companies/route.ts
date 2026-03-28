/**
 * 公司管理API
 * GET: 获取公司列表
 * POST: 创建公司
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getCompanyList,
  createCompany,
  getCompanyStats,
  CompanyListParams,
  CreateCompanyData,
} from '@/lib/company/service';

// 获取公司列表
async function getList(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const params: CompanyListParams = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      keyword: searchParams.get('keyword') || undefined,
      isActive: searchParams.get('isActive') === 'true' ? true : 
               searchParams.get('isActive') === 'false' ? false : undefined,
      industry: searchParams.get('industry') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    };

    // 判断是获取统计还是列表
    if (searchParams.get('stats') === 'true') {
      const stats = await getCompanyStats(userId);
      return NextResponse.json({ data: stats });
    }

    const { items, total } = await getCompanyList(params, userId);

    return NextResponse.json({
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / (params.pageSize || 20)),
    });
  } catch (error) {
    console.error('Get company list error:', error);
    return NextResponse.json({ error: '获取公司列表失败' }, { status: 500 });
  }
}

// 创建公司
async function create(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: '公司名称不能为空' }, { status: 400 });
    }

    if (!body.creditCode || !body.creditCode.trim()) {
      return NextResponse.json({ error: '统一社会信用代码不能为空' }, { status: 400 });
    }

    if (!body.registerAddress || !body.registerAddress.trim()) {
      return NextResponse.json({ error: '注册地址不能为空' }, { status: 400 });
    }

    if (!body.legalPersonName || !body.legalPersonName.trim()) {
      return NextResponse.json({ error: '法定代表人姓名不能为空' }, { status: 400 });
    }

    if (!body.contactPersonName || !body.contactPersonName.trim()) {
      return NextResponse.json({ error: '接口人姓名不能为空' }, { status: 400 });
    }

    // 构建数据对象
    const data: CreateCompanyData = {
      name: body.name.trim(),
      shortName: body.shortName?.trim(),
      creditCode: body.creditCode.trim(),
      registerAddress: body.registerAddress.trim(),
      officeAddress: body.officeAddress?.trim(),
      legalPersonName: body.legalPersonName.trim(),
      legalPersonIdCard: body.legalPersonIdCard?.trim(),
      agentName: body.agentName?.trim(),
      agentIdCard: body.agentIdCard?.trim(),
      contactPersonName: body.contactPersonName.trim(),
      contactPersonDept: body.contactPersonDept?.trim(),
      contactPersonPosition: body.contactPersonPosition?.trim(),
      contactPersonPhone: body.contactPersonPhone?.trim(),
      contactPersonEmail: body.contactPersonEmail?.trim(),
      contactPersonWechat: body.contactPersonWechat?.trim(),
      industry: body.industry,
      companyType: body.companyType,
      registeredCapital: body.registeredCapital,
      establishDate: body.establishDate ? new Date(body.establishDate) : undefined,
      businessScope: body.businessScope,
      bankName: body.bankName,
      bankAccount: body.bankAccount,
      taxpayerType: body.taxpayerType,
      description: body.description,
      remarks: body.remarks,
      isDefault: body.isDefault || false,
    };

    const companyId = await createCompany(data, userId);

    return NextResponse.json(
      {
        success: true,
        message: '公司创建成功',
        data: { id: companyId },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create company error:', error);
    const message = error instanceof Error ? error.message : '创建公司失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, getList);
}

export async function POST(request: NextRequest) {
  return withAuth(request, create);
}

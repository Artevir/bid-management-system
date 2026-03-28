import { NextRequest, NextResponse } from 'next/server';
import {
  addProjectOrgMember,
  getProjectOrgMembers,
  updateProjectOrgMember,
  removeProjectOrgMember,
} from '@/lib/project-org/service';

// GET /api/project-org/members - 获取项目成员列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: '缺少orgId参数' }, { status: 400 });
    }

    const members = await getProjectOrgMembers(parseInt(orgId));
    return NextResponse.json({ data: members });
  } catch (error) {
    console.error('获取成员列表失败:', error);
    return NextResponse.json({ error: '获取成员列表失败' }, { status: 500 });
  }
}

// POST /api/project-org/members - 添加项目成员
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const member = await addProjectOrgMember(body);
    return NextResponse.json({ data: member });
  } catch (error) {
    console.error('添加成员失败:', error);
    return NextResponse.json({ error: (error as Error).message || '添加成员失败' }, { status: 500 });
  }
}

// PUT /api/project-org/members - 更新成员信息
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { memberId, data } = body;

    const member = await updateProjectOrgMember(memberId, data);
    return NextResponse.json({ data: member });
  } catch (error) {
    console.error('更新成员失败:', error);
    return NextResponse.json({ error: '更新成员失败' }, { status: 500 });
  }
}

// DELETE /api/project-org/members - 移除成员
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: '缺少memberId参数' }, { status: 400 });
    }

    await removeProjectOrgMember(parseInt(memberId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('移除成员失败:', error);
    return NextResponse.json({ error: '移除成员失败' }, { status: 500 });
  }
}

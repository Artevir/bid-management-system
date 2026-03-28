import { NextRequest, NextResponse } from 'next/server';
import {
  createProjectPosition,
  updateProjectPosition,
  deleteProjectPosition,
} from '@/lib/project-org/service';

// POST /api/project-org/positions - 创建岗位
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const position = await createProjectPosition(body);
    return NextResponse.json({ data: position });
  } catch (error) {
    console.error('创建岗位失败:', error);
    return NextResponse.json({ error: '创建岗位失败' }, { status: 500 });
  }
}

// PUT /api/project-org/positions - 更新岗位
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { positionId, data } = body;
    const position = await updateProjectPosition(positionId, data);
    return NextResponse.json({ data: position });
  } catch (error) {
    console.error('更新岗位失败:', error);
    return NextResponse.json({ error: '更新岗位失败' }, { status: 500 });
  }
}

// DELETE /api/project-org/positions - 删除岗位
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get('positionId');

    if (!positionId) {
      return NextResponse.json({ error: '缺少positionId参数' }, { status: 400 });
    }

    await deleteProjectPosition(parseInt(positionId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除岗位失败:', error);
    return NextResponse.json({ error: '删除岗位失败' }, { status: 500 });
  }
}

/**
 * 单个解读记录API
 * GET: 获取解读详情
 * PUT: 更新解读信息
 * DELETE: 删除解读记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  getInterpretationById,
  updateInterpretation,
  deleteInterpretation,
  getInterpretationLogs,
  getTechnicalSpecs,
  getScoringItems,
  getChecklist,
  getDocumentFramework,
} from '@/lib/interpretation/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    // 获取基本信息
    const interpretation = await getInterpretationById(interpretationId);
    if (!interpretation) {
      return NextResponse.json({ error: '解读记录不存在' }, { status: 404 });
    }

    // 获取关联数据
    const [technicalSpecs, scoringItems, checklist, framework, logs] = await Promise.all([
      getTechnicalSpecs(interpretationId),
      getScoringItems(interpretationId),
      getChecklist(interpretationId),
      getDocumentFramework(interpretationId),
      getInterpretationLogs(interpretationId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...interpretation,
        technicalSpecs,
        scoringItems,
        checklist,
        framework,
        logs,
      },
    });
  } catch (error) {
    console.error('获取解读详情失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    const { projectName, projectCode, tenderOrganization, tenderAgent, projectBudget, tags, expireTime } = body;

    await updateInterpretation(
      interpretationId,
      {
        projectName,
        projectCode,
        tenderOrganization,
        tenderAgent,
        projectBudget,
        tags,
        expireTime: expireTime ? new Date(expireTime) : undefined,
      },
      user.userId
    );

    return NextResponse.json({
      success: true,
      message: '更新成功',
    });
  } catch (error) {
    console.error('更新解读记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    await deleteInterpretation(interpretationId, user.userId);

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除解读记录失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}

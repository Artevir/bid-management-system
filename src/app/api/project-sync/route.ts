/**
 * 项目信息联动API路由
 * 
 * POST /api/project-sync/sync - 同步解读信息到项目
 * POST /api/project-sync/link - 关联解读到项目
 * GET /api/project-sync/project-info/:projectId - 获取项目完整信息
 * GET /api/project-sync/unlinked - 获取未关联项目的解读列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  syncProjectFromInterpretation,
  getProjectFullInfo,
  getProjectKeyInfo,
  getProjectsWithInterpretation,
  getUnlinkedInterpretations,
  linkInterpretationToProject,
  getProjectTechnicalSpecs,
  getProjectScoringItems,
  getProjectDocumentFramework,
  getProjectQualificationRequirements,
  checkProjectHasInterpretation,
} from '@/lib/project-sync/service';

// GET - 获取项目信息或未关联解读列表
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // 获取项目完整信息
    if (action === 'project-info') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      if (!projectId) {
        return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
      }

      const info = await getProjectFullInfo(projectId);
      return NextResponse.json({ success: true, data: info });
    }

    // 获取项目关键信息（简化版）
    if (action === 'key-info') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      if (!projectId) {
        return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
      }

      const info = await getProjectKeyInfo(projectId);
      return NextResponse.json({ success: true, data: info });
    }

    // 获取未关联项目的解读列表
    if (action === 'unlinked') {
      const interpretations = await getUnlinkedInterpretations(session.user.id);
      return NextResponse.json({ success: true, data: interpretations });
    }

    // 获取项目列表（包含解读信息）
    if (action === 'list') {
      const status = searchParams.get('status') || undefined;
      const keyword = searchParams.get('keyword') || undefined;
      
      const projects = await getProjectsWithInterpretation({
        status,
        keyword,
        ownerId: searchParams.get('all') === 'true' ? undefined : session.user.id,
      });
      
      return NextResponse.json({ success: true, data: projects });
    }

    // 检查项目是否有解读信息
    if (action === 'check-interpretation') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      if (!projectId) {
        return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
      }

      const hasInterpretation = await checkProjectHasInterpretation(projectId);
      return NextResponse.json({ success: true, hasInterpretation });
    }

    // 获取项目技术规格
    if (action === 'technical-specs') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      const category = searchParams.get('category') || undefined;
      
      const specs = await getProjectTechnicalSpecs(projectId, category);
      return NextResponse.json({ success: true, data: specs });
    }

    // 获取项目评分细则
    if (action === 'scoring-items') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      const category = searchParams.get('category') || undefined;
      
      const items = await getProjectScoringItems(projectId, category);
      return NextResponse.json({ success: true, data: items });
    }

    // 获取项目文档框架
    if (action === 'document-framework') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      
      const framework = await getProjectDocumentFramework(projectId);
      return NextResponse.json({ success: true, data: framework });
    }

    // 获取项目资质要求
    if (action === 'qualification-requirements') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      
      const requirements = await getProjectQualificationRequirements(projectId);
      return NextResponse.json({ success: true, data: requirements });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('项目联动API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

// POST - 同步或关联操作
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { action, projectId, interpretationId, createNew } = body;

    // 同步解读信息到项目
    if (action === 'sync') {
      if (!projectId || !interpretationId) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      const result = await syncProjectFromInterpretation(
        projectId,
        interpretationId,
        session.user.id
      );

      return NextResponse.json(result);
    }

    // 关联解读到项目
    if (action === 'link') {
      if (!interpretationId) {
        return NextResponse.json({ error: '缺少解读ID' }, { status: 400 });
      }

      const result = await linkInterpretationToProject(
        interpretationId,
        createNew ? null : projectId,
        session.user.id
      );

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('项目联动API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

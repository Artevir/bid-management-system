import { NextRequest, NextResponse } from 'next/server';
import {
  getOrgTemplates,
  createOrgTemplate,
  getProjectOrg,
  createProjectOrg,
  createProjectOrgFromTemplate,
  initSystemTemplates,
} from '@/lib/project-org/service';

// GET /api/project-org - 获取组织架构模板或项目组织
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const type = searchParams.get('type');

    if (type === 'templates') {
      // 初始化系统模板
      await initSystemTemplates();
      const templates = await getOrgTemplates();
      return NextResponse.json({ data: templates });
    }

    if (projectId) {
      const org = await getProjectOrg(parseInt(projectId));
      return NextResponse.json({ data: org });
    }

    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('获取组织架构失败:', error);
    return NextResponse.json({ error: '获取组织架构失败' }, { status: 500 });
  }
}

// POST /api/project-org - 创建组织架构模板或项目组织
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === 'createFromTemplate') {
      const { projectId, templateId, userId } = data;
      const org = await createProjectOrgFromTemplate(projectId, templateId, userId);
      return NextResponse.json({ data: org });
    }

    if (action === 'createTemplate') {
      const template = await createOrgTemplate(data);
      return NextResponse.json({ data: template });
    }

    if (action === 'createOrg') {
      const org = await createProjectOrg(data);
      return NextResponse.json({ data: org });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('创建组织架构失败:', error);
    return NextResponse.json({ error: (error as Error).message || '创建组织架构失败' }, { status: 500 });
  }
}

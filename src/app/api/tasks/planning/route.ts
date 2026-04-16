/**
 * 智能任务规划API路由
 * GET /api/tasks/planning - 获取可用的文件解读列表
 * POST /api/tasks/planning - 生成任务分解计划
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getAvailableInterpretations, generateTaskPlan } from '@/lib/task-planning/service';
import { parseResourceId } from '@/lib/api/validators';
import { hasProjectPermission } from '@/lib/project/member';
import { db } from '@/db';
import { bidDocumentInterpretations } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET - 获取可用的文件解读列表（必须带 projectId，且仅有项目查看权限的用户可列）
export async function GET(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const projectIdRaw = searchParams.get('projectId');
      if (!projectIdRaw) {
        return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
      }
      const projectId = parseResourceId(projectIdRaw, '项目');
      const allowed = await hasProjectPermission(projectId, userId, 'view');
      if (!allowed) {
        return NextResponse.json({ error: '无权访问该项目' }, { status: 403 });
      }

      const interpretations = await getAvailableInterpretations(projectId);
      return NextResponse.json(interpretations);
    } catch (error) {
      console.error('获取文件解读列表失败:', error);
      return NextResponse.json({ error: '获取文件解读列表失败' }, { status: 500 });
    }
  });
}

// POST - 生成任务分解计划
export async function POST(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const body = await request.json();
      const { interpretationId, projectId: bodyProjectId, additionalContext } = body;

      if (interpretationId == null) {
        return NextResponse.json({ error: '请选择要解析的招标文件' }, { status: 400 });
      }

      const interpId = parseResourceId(String(interpretationId), '文件解读');

      const interpretation = await db.query.bidDocumentInterpretations.findFirst({
        where: eq(bidDocumentInterpretations.id, interpId),
        columns: { id: true, projectId: true },
      });

      if (!interpretation) {
        return NextResponse.json({ error: '文件解读记录不存在' }, { status: 404 });
      }

      const resolvedBodyProjectId =
        bodyProjectId != null && bodyProjectId !== ''
          ? parseResourceId(String(bodyProjectId), '项目')
          : undefined;

      if (
        resolvedBodyProjectId != null &&
        interpretation.projectId != null &&
        resolvedBodyProjectId !== interpretation.projectId
      ) {
        return NextResponse.json({ error: '项目与文件解读不匹配' }, { status: 400 });
      }

      const effectiveProjectId = resolvedBodyProjectId ?? interpretation.projectId ?? undefined;
      if (effectiveProjectId == null) {
        return NextResponse.json({ error: '缺少项目上下文' }, { status: 400 });
      }

      const canPlan = await hasProjectPermission(effectiveProjectId, userId, 'edit');
      if (!canPlan) {
        return NextResponse.json({ error: '无权在该项目下生成任务计划' }, { status: 403 });
      }

      const result = await generateTaskPlan({
        interpretationId: interpId,
        projectId: effectiveProjectId,
        additionalContext,
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error('生成任务计划失败:', error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : '生成任务计划失败',
        },
        { status: 500 }
      );
    }
  });
}

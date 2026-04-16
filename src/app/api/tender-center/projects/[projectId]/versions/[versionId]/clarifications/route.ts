import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { clarificationCandidates, tenderProjects, tenderProjectVersions } from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/clarifications
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  return withAuth(request, async (_req, userId) => {
    const { version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const rows = await db.query.clarificationCandidates.findMany({
      where: and(
        eq(clarificationCandidates.tenderProjectVersionId, version.id),
        eq(clarificationCandidates.isDeleted, false)
      ),
    });

    const data = rows.map((row) => ({
      clarificationId: row.id,
      requirementId: row.relatedRequirementId,
      title: row.questionTitle,
      detail: row.questionContent,
      status: row.reviewStatus,
    }));

    return NextResponse.json({ success: true, data });
  });
}

// 060: POST /api/tender-center/projects/{projectId}/versions/{versionId}/clarifications
// 生成澄清候选 create_clarification
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  return withAuth(request, async (req, userId) => {
    const { version, project } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return tenderCenterError('未找到对应版本', 404);
    }

    const body = await req.json().catch(() => ({}));
    const sourceType = String(body.sourceType || 'risk'); // risk, conflict, requirement
    const sourceId = Number(body.sourceId);
    const questionTitle = String(body.title || '').trim();
    const questionContent = String(body.content || '').trim();

    if (!sourceId || !questionTitle) {
      return tenderCenterError('缺少必要参数 sourceId 或 title', 400);
    }

    const validSourceTypes = ['risk', 'conflict', 'requirement'];
    if (!validSourceTypes.includes(sourceType)) {
      return tenderCenterError('无效的 sourceType', 400);
    }

    const [newClarification] = await db
      .insert(clarificationCandidates)
      .values({
        tenderProjectVersionId: version.id,
        relatedRequirementId: sourceType === 'requirement' ? sourceId : null,
        sourceRiskId: sourceType === 'risk' ? sourceId : null,
        sourceConflictId: sourceType === 'conflict' ? sourceId : null,
        questionTitle,
        questionContent,
        reviewStatus: 'pending_review',
        urgencyLevel: body.urgencyLevel || 'medium',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        clarificationId: newClarification.id,
        sourceType,
        sourceId,
        title: questionTitle,
        status: 'pending_review',
        action: 'create_clarification',
      },
      message: '澄清候选创建成功',
    });
  });
}

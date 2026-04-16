import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { db } from '@/db';
import { submissionMaterials, responseTaskItems, clarificationCandidates } from '@/db/schema';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/preparation-detail
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

    const [materials, tasks, clarifications] = await Promise.all([
      db.query.submissionMaterials.findMany({
        where: and(
          eq(submissionMaterials.tenderProjectVersionId, version.id),
          eq(submissionMaterials.isDeleted, false)
        ),
      }),
      db.query.responseTaskItems.findMany({
        where: and(
          eq(responseTaskItems.tenderProjectVersionId, version.id),
          eq(responseTaskItems.isDeleted, false)
        ),
      }),
      db.query.clarificationCandidates.findMany({
        where: and(
          eq(clarificationCandidates.tenderProjectVersionId, version.id),
          eq(clarificationCandidates.isDeleted, false)
        ),
      }),
    ]);

    const materialData = materials.map((m) => ({
      type: 'material',
      id: m.id,
      name: m.materialName,
      subType: m.materialType,
      required: m.requiredFlag,
      needSignature: m.needSignatureFlag,
      needSeal: m.needSealFlag,
      status: m.reviewStatus,
      note: m.note,
      sourceReason: m.sourceReason,
    }));

    const taskData = tasks.map((t) => ({
      type: 'task',
      id: t.id,
      name: t.taskTitle,
      subType: t.taskType,
      priority: t.priorityLevel,
      status: t.status,
      deadline: t.deadlineTime?.toISOString() ?? null,
      responsibilityRole: t.responsibilityRole,
    }));

    const clarificationData = clarifications.map((c) => ({
      type: 'clarification',
      id: c.id,
      name: c.questionTitle,
      content: c.questionContent,
      reason: c.questionReason,
      urgency: c.urgencyLevel,
      status: c.reviewStatus,
    }));

    return NextResponse.json({
      success: true,
      data: {
        materials: materialData,
        tasks: taskData,
        clarifications: clarificationData,
        summary: {
          materialCount: materialData.length,
          requiredMaterialCount: materialData.filter((m) => m.required).length,
          taskCount: taskData.length,
          pendingTaskCount: taskData.filter((t) => t.status === 'pending').length,
          clarificationCount: clarificationData.length,
          urgentClarificationCount: clarificationData.filter((c) => c.urgency === 'high').length,
        },
      },
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  responseTaskItems,
  submissionMaterials,
  tenderRequirements,
  riskItems,
  hubBidTemplates,
} from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import { tenderCenterError } from '@/app/api/tender-center/_response';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/response-tasks
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

    const rows = await db.query.responseTaskItems.findMany({
      where: and(
        eq(responseTaskItems.tenderProjectVersionId, version.id),
        eq(responseTaskItems.isDeleted, false)
      ),
    });

    const tasks = rows.map((row) => ({
      taskId: row.id,
      requirementId: null as number | null,
      title: row.taskTitle,
      priority: row.priorityLevel,
      status: row.status,
      taskType: row.taskType,
    }));

    return NextResponse.json({ success: true, data: tasks });
  });
}

// 060: POST /api/tender-center/projects/{projectId}/versions/{versionId}/response-tasks
// create_response_task 转响应任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  return withAuth(request, async (req, userId) => {
    const { version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return tenderCenterError('未找到对应版本', 404);
    }

    const body = await req.json().catch(() => ({}));
    const sourceType = String(body.sourceType || '');
    const sourceId = Number(body.sourceId);

    if (!sourceType || !sourceId) {
      return tenderCenterError('缺少必要参数 sourceType 或 sourceId', 400);
    }

    const validSources = ['requirement', 'risk', 'material', 'framework'];
    if (!validSources.includes(sourceType)) {
      return tenderCenterError('无效的 sourceType', 400);
    }

    let taskType:
      | 'prepare_material'
      | 'write_chapter'
      | 'fill_template'
      | 'confirm_business_term'
      | 'confirm_technical_term'
      | 'prepare_clarification'
      | 'review_risk'
      | 'other_task' = 'other_task';

    if (sourceType === 'requirement') {
      const [reqRow] = await db
        .select({ title: tenderRequirements.title })
        .from(tenderRequirements)
        .where(
          and(
            eq(tenderRequirements.id, sourceId),
            eq(tenderRequirements.tenderProjectVersionId, version.id)
          )
        )
        .limit(1);
      if (!reqRow) {
        return tenderCenterError('源要求不存在', 404);
      }
      taskTitle = reqRow.title || `要求 #${sourceId}`;
      taskType = 'prepare_material';
    } else if (sourceType === 'risk') {
      const [riskRow] = await db
        .select({ title: riskItems.riskTitle })
        .from(riskItems)
        .where(and(eq(riskItems.id, sourceId), eq(riskItems.tenderProjectVersionId, version.id)))
        .limit(1);
      if (!riskRow) {
        return tenderCenterError('源风险不存在', 404);
      }
      taskTitle = riskRow.title || `风险 #${sourceId}`;
      taskType = 'risk_mitigation';
    } else if (sourceType === 'material') {
      const [matRow] = await db
        .select({ materialName: submissionMaterials.materialName })
        .from(submissionMaterials)
        .where(
          and(
            eq(submissionMaterials.id, sourceId),
            eq(submissionMaterials.tenderProjectVersionId, version.id)
          )
        )
        .limit(1);
      if (!matRow) {
        return tenderCenterError('源材料不存在', 404);
      }
      taskTitle = matRow.materialName || `材料 #${sourceId}`;
      taskType = 'submission';
    } else if (sourceType === 'framework') {
      const [fwRow] = await db
        .select({ nodeTitle: hubBidTemplates.templateName })
        .from(hubBidTemplates)
        .where(
          and(
            eq(hubBidTemplates.id, sourceId),
            eq(hubBidTemplates.tenderProjectVersionId, version.id)
          )
        )
        .limit(1);
      if (!fwRow) {
        return tenderCenterError('源框架不存在', 404);
      }
      taskTitle = fwRow.nodeTitle || `框架 #${sourceId}`;
      taskType = 'framework_response';
    }

    const [newTask] = await db
      .insert(responseTaskItems)
      .values({
        tenderProjectVersionId: version.id,
        taskTitle,
        taskType,
        status: 'pending',
        priorityLevel: body.priority || 'p2',
        ...(sourceType === 'requirement'
          ? { relatedRequirementId: sourceId, sourceObjectType: 'tender_requirement' }
          : {}),
        ...(sourceType === 'material'
          ? { relatedMaterialId: sourceId, sourceObjectType: 'submission_material' }
          : {}),
        ...(sourceType === 'risk' ? { sourceObjectType: 'risk_item' } : {}),
        ...(sourceType === 'framework' ? { sourceObjectType: 'bid_framework_node' } : {}),
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        taskId: newTask.id,
        sourceType,
        sourceId,
        title: taskTitle,
        type: taskType,
        action: 'create_response_task',
      },
      message: '响应任务创建成功',
    });
  });
}

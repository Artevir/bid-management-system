import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import {
  attachmentRequirementNodes,
  bidFrameworkNodes,
  clarificationCandidates,
  conflictItems,
  frameworkRequirementBindings,
  hubBidTemplates,
  moneyTerms,
  responseTaskItems,
  reviewTasks,
  riskItems,
  scoringItems,
  scoringSchemes,
  submissionMaterials,
  submissionRequirements,
  technicalSpecGroups,
  technicalSpecItems,
  templateVariables,
  tenderRequirements,
  timeNodes,
} from '@/db/schema';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';
import {
  buildCsvText,
  getTenderCenterExportColumns,
  isTenderCenterExportViewCode,
  type TenderCenterExportViewCode,
} from '@/app/api/tender-center/_export';
import { isTenderSnapshotType, type TenderSnapshotType } from '@/app/api/tender-center/_snapshot';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/export
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const url = new URL(request.url);
  const format = String(url.searchParams.get('format') || 'json').toLowerCase();
  const requestedView = String(url.searchParams.get('view') || 'requirements_export_view');
  const requestedSnapshotType = url.searchParams.get('snapshotType');
  const viewCode: TenderCenterExportViewCode = isTenderCenterExportViewCode(requestedView)
    ? requestedView
    : 'requirements_export_view';
  const snapshotType: TenderSnapshotType | null =
    requestedSnapshotType && isTenderSnapshotType(requestedSnapshotType)
      ? requestedSnapshotType
      : null;
  if (requestedSnapshotType && !snapshotType) {
    return NextResponse.json(
      {
        error:
          'snapshotType 非法，仅支持 requirements_snapshot/framework_snapshot/templates_snapshot/materials_snapshot/full_snapshot',
      },
      { status: 400 }
    );
  }

  return withAuth(request, async (_req, userId) => {
    const { project, version } = await resolveHubProjectAndVersion({
      projectId,
      versionId,
      userId,
    });
    if (!version) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }

    const verFilter = eq(tenderRequirements.tenderProjectVersionId, version.id);
    const notDelReq = eq(tenderRequirements.isDeleted, false);

    const [
      requirements,
      riskRows,
      conflictRows,
      frameworkRows,
      templateRows,
      submissionMat,
      scoringJoined,
      technicalJoined,
      reviewTaskRows,
      timeNodeRows,
      moneyTermRows,
      submissionReqRows,
      clarificationRows,
      responseTaskRows,
      attachmentReqRows,
      frameworkBindingRows,
    ] = await Promise.all([
      db.query.tenderRequirements.findMany({
        where: and(verFilter, notDelReq),
      }),
      db.query.riskItems.findMany({
        where: and(
          eq(riskItems.tenderProjectVersionId, version.id),
          eq(riskItems.isDeleted, false)
        ),
      }),
      db.query.conflictItems.findMany({
        where: and(
          eq(conflictItems.tenderProjectVersionId, version.id),
          eq(conflictItems.isDeleted, false)
        ),
      }),
      db.query.bidFrameworkNodes.findMany({
        where: and(
          eq(bidFrameworkNodes.tenderProjectVersionId, version.id),
          eq(bidFrameworkNodes.isDeleted, false)
        ),
      }),
      db.query.hubBidTemplates.findMany({
        where: and(
          eq(hubBidTemplates.tenderProjectVersionId, version.id),
          eq(hubBidTemplates.isDeleted, false)
        ),
      }),
      db.query.submissionMaterials.findMany({
        where: and(
          eq(submissionMaterials.tenderProjectVersionId, version.id),
          eq(submissionMaterials.isDeleted, false)
        ),
      }),
      db
        .select({
          id: scoringItems.id,
          scoringCategory: scoringItems.categoryName,
          itemName: scoringItems.itemName,
          scoringCriteria: scoringItems.criteriaText,
          maxScore: scoringItems.scoreValue,
          pageNumber: scoringItems.sourceSegmentId,
        })
        .from(scoringItems)
        .innerJoin(scoringSchemes, eq(scoringSchemes.id, scoringItems.scoringSchemeId))
        .where(
          and(
            eq(scoringSchemes.tenderProjectVersionId, version.id),
            eq(scoringSchemes.isDeleted, false),
            eq(scoringItems.isDeleted, false)
          )
        ),
      db
        .select({
          id: technicalSpecItems.id,
          specCategory: technicalSpecGroups.groupName,
          specName: technicalSpecItems.specName,
          specRequirement: technicalSpecItems.specRequirement,
          isMandatory: technicalSpecItems.starFlag,
          pageNumber: technicalSpecItems.sourceSegmentId,
        })
        .from(technicalSpecItems)
        .innerJoin(
          technicalSpecGroups,
          eq(technicalSpecGroups.id, technicalSpecItems.technicalSpecGroupId)
        )
        .where(
          and(
            eq(technicalSpecGroups.tenderProjectVersionId, version.id),
            eq(technicalSpecGroups.isDeleted, false),
            eq(technicalSpecItems.isDeleted, false)
          )
        ),
      db.query.reviewTasks.findMany({
        where: eq(reviewTasks.tenderProjectVersionId, version.id),
      }),
      db.query.timeNodes.findMany({
        where: and(
          eq(timeNodes.tenderProjectVersionId, version.id),
          eq(timeNodes.isDeleted, false)
        ),
      }),
      db.query.moneyTerms.findMany({
        where: and(
          eq(moneyTerms.tenderProjectVersionId, version.id),
          eq(moneyTerms.isDeleted, false)
        ),
      }),
      db.query.submissionRequirements.findMany({
        where: and(
          eq(submissionRequirements.tenderProjectVersionId, version.id),
          eq(submissionRequirements.isDeleted, false)
        ),
      }),
      db.query.clarificationCandidates.findMany({
        where: and(
          eq(clarificationCandidates.tenderProjectVersionId, version.id),
          eq(clarificationCandidates.isDeleted, false)
        ),
      }),
      db.query.responseTaskItems.findMany({
        where: and(
          eq(responseTaskItems.tenderProjectVersionId, version.id),
          eq(responseTaskItems.isDeleted, false)
        ),
      }),
      db.query.attachmentRequirementNodes.findMany({
        where: and(
          eq(attachmentRequirementNodes.tenderProjectVersionId, version.id),
          eq(attachmentRequirementNodes.isDeleted, false)
        ),
      }),
      db
        .select({
          bindingId: frameworkRequirementBindings.id,
          bidFrameworkNodeId: frameworkRequirementBindings.bidFrameworkNodeId,
          tenderRequirementId: frameworkRequirementBindings.tenderRequirementId,
          bindingType: frameworkRequirementBindings.bindingType,
        })
        .from(frameworkRequirementBindings)
        .innerJoin(
          bidFrameworkNodes,
          eq(bidFrameworkNodes.id, frameworkRequirementBindings.bidFrameworkNodeId)
        )
        .where(
          and(
            eq(bidFrameworkNodes.tenderProjectVersionId, version.id),
            eq(bidFrameworkNodes.isDeleted, false)
          )
        ),
    ]);

    const tplIds = templateRows.map((t) => t.id);
    const templateVarDb =
      tplIds.length === 0
        ? []
        : await db.query.templateVariables.findMany({
            where: inArray(templateVariables.bidTemplateId, tplIds),
          });

    const risksExportView = riskRows.map((row) => ({
      riskId: `risk-${row.id}`,
      riskType: row.riskType,
      riskLevel: row.riskLevel,
      riskTitle: row.riskTitle,
      sourcePageNo: row.sourceSegmentId,
    }));

    const conflictsExportView = conflictRows.map((row) => ({
      conflictId: `conflict-${row.id}`,
      fieldName: row.fieldName,
      candidateA: row.candidateA,
      candidateB: row.candidateB,
      finalResolution: row.finalResolution,
      sourcePageNoA: row.sourceASegmentId,
      sourcePageNoB: row.sourceBSegmentId,
    }));

    const templatesExportView = templateRows.map((row) => ({
      templateId: `template-${row.id}`,
      templateName: row.templateName,
      templateType: row.templateType,
      fixedFormatFlag: row.fixedFormatFlag,
      sourcePageNo: row.sourcePageNo,
    }));

    const templateVariablesExportView = templateVarDb.map((v) => ({
      variableId: `var-${v.id}`,
      variableName: v.variableName,
      requiredFlag: v.requiredFlag,
      editableFlag: v.editableFlag,
      sourcePageNo: v.sourceSegmentId,
    }));

    const materialsExportView = submissionMat.map((m) => ({
      materialId: `mat-${m.id}`,
      materialName: m.materialName,
      materialType: m.materialType,
      sourceRequirementId: m.relatedRequirementId,
      sourcePageNo: null,
    }));

    const reviewsExportView = reviewTaskRows.map((row) => ({
      reviewTaskId: `review-hub-${row.id}`,
      reviewStatus: row.reviewStatus,
      reviewReason: row.reviewReason,
      reviewTime: row.reviewedAt ?? row.createdAt,
      reviewerId: row.assignedTo,
    }));

    const scoringExportView = scoringJoined.map((item) => ({
      scoringItemId: item.id,
      scoringCategory: item.scoringCategory,
      itemName: item.itemName,
      scoringCriteria: item.scoringCriteria,
      maxScore: item.maxScore,
      sourcePageNo: item.pageNumber,
    }));

    const technicalExportView = technicalJoined.map((item) => ({
      technicalItemId: item.id,
      specCategory: item.specCategory,
      specName: item.specName,
      specRequirement: item.specRequirement,
      isMandatory: item.isMandatory,
      sourcePageNo: item.pageNumber,
    }));

    const frameworkExportView = frameworkRows.map((item) => ({
      frameworkNodeId: item.id,
      frameworkNo: item.frameworkNo,
      frameworkTitle: item.frameworkTitle,
      levelNo: item.levelNo,
      requiredType: item.requiredType,
      generationMode: item.generationMode,
      sourcePageNo: item.sourceSegmentId,
    }));

    const requirementsSnapshot = requirements.map((row) => ({
      requirementId: row.id,
      requirementType: row.requirementType,
      title: row.title,
      content: row.content,
      sourcePageNo: row.sourcePageNo,
      reviewStatus: row.reviewStatus,
      confidenceScore: row.confidenceScore,
    }));

    const frameworkSnapshot = frameworkRows.map((row) => ({
      nodeId: row.id,
      parentNodeId: row.parentId,
      title: row.frameworkTitle,
      nodeType: row.contentType,
      generationMode: row.generationMode,
      sourcePageNo: row.sourceSegmentId,
    }));

    const templatesSnapshot = templateRows.map((row) => ({
      templateId: `template-${row.id}`,
      templateName: row.templateName,
      templateType: row.templateType,
      fixedFormatFlag: row.fixedFormatFlag,
      variableCount: templateVarDb.filter((v) => v.bidTemplateId === row.id).length,
      sourcePageNo: row.sourcePageNo,
    }));

    const materialsSnapshot = materialsExportView.map((item) => ({
      materialId: item.materialId,
      materialName: item.materialName,
      materialType: item.materialType,
      sourceRequirementId: item.sourceRequirementId,
      sourcePageNo: item.sourcePageNo,
    }));

    const fullSnapshot = {
      context: {
        projectId: project.id,
        versionId: version.id,
        interpretationId: null as number | null,
      },
      requirements: requirementsSnapshot,
      framework: frameworkSnapshot,
      frameworkBindings: frameworkBindingRows,
      templates: templatesSnapshot,
      materials: materialsSnapshot,
      risks: risksExportView,
      conflicts: conflictsExportView,
      scoringItems: scoringExportView.map((item) => ({
        scoringItemId: item.scoringItemId,
        category: item.scoringCategory,
        itemName: item.itemName,
        scoreValue: item.maxScore,
        sourcePageNo: item.sourcePageNo,
      })),
      technicalItems: technicalExportView.map((item) => ({
        technicalItemId: item.technicalItemId,
        specCategory: item.specCategory,
        specName: item.specName,
        specRequirement: item.specRequirement,
        sourcePageNo: item.sourcePageNo,
      })),
      timeNodes: timeNodeRows.map((t) => ({
        timeNodeId: t.id,
        nodeType: t.nodeType,
        nodeName: t.nodeName,
        timeText: t.timeText,
        sourceSegmentId: t.sourceSegmentId,
      })),
      moneyTerms: moneyTermRows.map((m) => ({
        moneyTermId: m.id,
        moneyType: m.moneyType,
        amountText: m.amountText,
        sourceSegmentId: m.sourceSegmentId,
      })),
      submissionRequirements: submissionReqRows.map((s) => ({
        submissionRequirementId: s.id,
        submissionType: s.submissionType,
        requirementText: s.requirementText,
        sourceSegmentId: s.sourceSegmentId,
      })),
      clarificationCandidates: clarificationRows.map((c) => ({
        clarificationCandidateId: c.id,
        questionTitle: c.questionTitle,
        urgencyLevel: c.urgencyLevel,
        relatedRequirementId: c.relatedRequirementId,
      })),
      responseTaskItems: responseTaskRows.map((r) => ({
        responseTaskId: r.id,
        taskType: r.taskType,
        taskTitle: r.taskTitle,
        status: r.status,
        priorityLevel: r.priorityLevel,
      })),
      attachmentRequirementNodes: attachmentReqRows.map((a) => ({
        attachmentNodeId: a.id,
        attachmentName: a.attachmentName,
        attachmentType: a.attachmentType,
        sourceSegmentId: a.sourceSegmentId,
      })),
    };

    const payload = {
      projectId: project.id,
      versionId: version.id,
      interpretationId: null as number | null,
      generatedAt: new Date().toISOString(),
      summary: {
        requirements: requirements.length,
        technicalItems: technicalJoined.length,
        scoringItems: scoringJoined.length,
        timeNodes: timeNodeRows.length,
        moneyTerms: moneyTermRows.length,
        submissionRequirements: submissionReqRows.length,
        clarifications: clarificationRows.length,
        responseTasks: responseTaskRows.length,
        attachmentRequirements: attachmentReqRows.length,
        frameworkBindings: frameworkBindingRows.length,
      },
      views: {
        requirements_export_view: requirementsSnapshot,
        risks_export_view: risksExportView,
        conflicts_export_view: conflictsExportView,
        scoring_export_view: scoringExportView,
        technical_export_view: technicalExportView,
        framework_export_view: frameworkExportView,
        templates_export_view: templatesExportView,
        template_variables_export_view: templateVariablesExportView,
        materials_export_view: materialsExportView,
        reviews_export_view: reviewsExportView,
      },
      snapshots: {
        requirements_snapshot: requirementsSnapshot,
        framework_snapshot: frameworkSnapshot,
        templates_snapshot: templatesSnapshot,
        materials_snapshot: materialsSnapshot,
        full_snapshot: fullSnapshot,
      },
      requirements,
      technicalItems: technicalJoined,
      scoringItems: scoringJoined,
    };

    if (format === 'csv') {
      const rows = (payload.views[viewCode] || []) as Record<string, unknown>[];
      const columns = getTenderCenterExportColumns(viewCode);
      const csv = buildCsvText(rows, columns);
      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=${viewCode}-${project.id}-${version.id}.csv`,
        },
      });
    }

    if (snapshotType) {
      return NextResponse.json({
        success: true,
        data: {
          projectId: project.id,
          versionId: version.id,
          interpretationId: null,
          snapshotType,
          snapshot: payload.snapshots[snapshotType],
          generatedAt: payload.generatedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: payload,
    });
  });
}

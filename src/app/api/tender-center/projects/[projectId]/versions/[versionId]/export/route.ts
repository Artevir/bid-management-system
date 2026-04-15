import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/auth/middleware';
import { parseResourceId } from '@/lib/api/validators';
import { db } from '@/db';
import { bidRequirementChecklist, bidTechnicalSpecs, bidScoringItems } from '@/db/schema';
import { resolveInterpretationByProjectAndVersion } from '@/app/api/tender-center/_utils';
import {
  getFrameworkRows,
  getReviewLogs,
  parseJsonArray,
  extractTemplateVariables,
} from '@/app/api/tender-center/_view';
import {
  buildCsvText,
  getTenderCenterExportColumns,
  isTenderCenterExportViewCode,
  type TenderCenterExportViewCode,
} from '@/app/api/tender-center/_export';

// 040: GET /api/tender-center/projects/{projectId}/versions/{versionId}/export
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  const { projectId, versionId } = await params;
  const pid = parseResourceId(projectId, '项目');
  const url = new URL(request.url);
  const format = String(url.searchParams.get('format') || 'json').toLowerCase();
  const requestedView = String(url.searchParams.get('view') || 'requirements_export_view');
  const viewCode: TenderCenterExportViewCode = isTenderCenterExportViewCode(requestedView)
    ? requestedView
    : 'requirements_export_view';

  return withAuth(request, async (_req, userId) => {
    const interpretation = await resolveInterpretationByProjectAndVersion(pid, versionId);
    if (!interpretation) {
      return NextResponse.json({ error: '未找到对应版本' }, { status: 404 });
    }
    if (interpretation.uploaderId !== userId) {
      return NextResponse.json({ error: '无权访问该版本' }, { status: 403 });
    }

    const [requirements, technicalItems, scoringItems] = await Promise.all([
      db
        .select()
        .from(bidRequirementChecklist)
        .where(eq(bidRequirementChecklist.interpretationId, interpretation.id)),
      db
        .select()
        .from(bidTechnicalSpecs)
        .where(eq(bidTechnicalSpecs.interpretationId, interpretation.id)),
      db
        .select()
        .from(bidScoringItems)
        .where(eq(bidScoringItems.interpretationId, interpretation.id)),
    ]);
    const [frameworkRows, reviewLogs] = await Promise.all([
      getFrameworkRows(interpretation.id),
      getReviewLogs(interpretation.id),
    ]);

    const risksExportView = requirements
      .filter((row) => row.checkStatus && row.checkStatus !== 'compliant')
      .map((row) => ({
        riskId: `req-${row.id}`,
        riskType: row.checklistCategory,
        riskLevel:
          row.checkStatus === 'non_compliant'
            ? 'high'
            : row.checkStatus === 'partial'
              ? 'medium'
              : 'low',
        riskTitle: row.itemName,
        sourcePageNo: row.pageNumber,
      }));

    const conflictsExportView = requirements
      .filter((row) => row.checkStatus === 'non_compliant' || row.checkStatus === 'partial')
      .map((row) => ({
        conflictId: `conflict-${row.id}`,
        fieldName: row.itemName,
        candidateA: row.requiredValue,
        candidateB: row.actualValue,
        finalResolution: row.improvementSuggestion,
        sourcePageNoA: row.pageNumber,
        sourcePageNoB: row.pageNumber,
      }));

    const templatesExportView = frameworkRows.map((row) => ({
      templateId: `template-${row.id}`,
      templateName: row.chapterTitle,
      templateType: row.chapterType || 'general',
      fixedFormatFlag: Boolean(row.formatRequirement),
      sourcePageNo: row.pageNumber,
    }));

    const templateVariablesExportView = frameworkRows.flatMap((row) => {
      const text = [
        row.chapterTitle,
        row.contentRequirement,
        row.formatRequirement,
        row.originalText,
      ]
        .filter(Boolean)
        .join('\n');
      return extractTemplateVariables(text).map((name, index) => ({
        variableId: `var-${row.id}-${index + 1}`,
        variableName: name,
        requiredFlag: true,
        editableFlag: true,
        sourcePageNo: row.pageNumber,
      }));
    });

    const materialsExportView = requirements.flatMap((row) =>
      parseJsonArray(row.requiredDocuments).map((doc, idx) => ({
        materialId: `mat-${row.id}-${idx + 1}`,
        materialName: doc,
        materialType: row.checklistCategory,
        sourceRequirementId: row.id,
        sourcePageNo: row.pageNumber,
      }))
    );

    const reviewsExportView = reviewLogs
      .filter(
        (log) => log.operationType === 'review_created' || log.operationType === 'review_submitted'
      )
      .map((log) => ({
        reviewTaskId: `review-log-${log.id}`,
        reviewStatus: log.operationType,
        reviewReason: log.operationContent,
        reviewTime: log.operationTime,
        reviewerId: log.operatorId,
      }));

    const scoringExportView = scoringItems.map((item) => ({
      scoringItemId: item.id,
      scoringCategory: item.scoringCategory,
      itemName: item.itemName,
      scoringCriteria: item.scoringCriteria,
      maxScore: item.maxScore,
      sourcePageNo: item.pageNumber,
    }));

    const technicalExportView = technicalItems.map((item) => ({
      technicalItemId: item.id,
      specCategory: item.specCategory,
      specName: item.specName,
      specRequirement: item.specRequirement,
      isMandatory: item.isMandatory,
      sourcePageNo: item.pageNumber,
    }));

    const frameworkExportView = frameworkRows.map((item) => ({
      frameworkNodeId: item.id,
      frameworkNo: item.chapterNumber,
      frameworkTitle: item.chapterTitle,
      levelNo: item.level,
      requiredType: item.contentRequirement ? 'required' : 'optional',
      generationMode: item.contentRequirement ? 'ai' : 'manual',
      sourcePageNo: item.pageNumber,
    }));

    const requirementsSnapshot = requirements.map((row) => ({
      requirementId: row.id,
      requirementType: row.checklistCategory,
      title: row.itemName,
      content: row.requirementDetail || row.itemDescription,
      sourcePageNo: row.pageNumber,
      reviewStatus: row.checkStatus,
      confidenceScore: interpretation.extractAccuracy,
    }));

    const frameworkSnapshot = frameworkRows.map((row) => ({
      nodeId: row.id,
      parentNodeId: row.parentId,
      title: row.chapterTitle,
      nodeType: row.chapterType,
      generationMode: row.contentRequirement ? 'ai' : 'manual',
      sourcePageNo: row.pageNumber,
    }));

    const templatesSnapshot = templatesExportView.map((item) => ({
      templateId: item.templateId,
      templateName: item.templateName,
      templateType: item.templateType,
      fixedFormatFlag: item.fixedFormatFlag,
      variableCount: templateVariablesExportView.filter((v) =>
        v.variableId.startsWith(`var-${item.templateId.replace('template-', '')}-`)
      ).length,
      sourcePageNo: item.sourcePageNo,
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
        projectId: pid,
        versionId,
        interpretationId: interpretation.id,
      },
      requirements: requirementsSnapshot,
      framework: frameworkSnapshot,
      templates: templatesSnapshot,
      materials: materialsSnapshot,
      risks: risksExportView,
      conflicts: conflictsExportView,
      scoringItems: scoringItems.map((item) => ({
        scoringItemId: item.id,
        category: item.scoringCategory,
        itemName: item.itemName,
        scoreValue: item.maxScore,
        sourcePageNo: item.pageNumber,
      })),
      technicalItems: technicalItems.map((item) => ({
        technicalItemId: item.id,
        specCategory: item.specCategory,
        specName: item.specName,
        specRequirement: item.specRequirement,
        sourcePageNo: item.pageNumber,
      })),
    };

    const payload = {
      projectId: pid,
      versionId,
      interpretationId: interpretation.id,
      generatedAt: new Date().toISOString(),
      summary: {
        requirements: requirements.length,
        technicalItems: technicalItems.length,
        scoringItems: scoringItems.length,
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
      technicalItems,
      scoringItems,
    };

    if (format === 'csv') {
      const rows = (payload.views[viewCode] || []) as Record<string, unknown>[];
      const columns = getTenderCenterExportColumns(viewCode);
      const csv = buildCsvText(rows, columns);
      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=${viewCode}-${pid}-${versionId}.csv`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: payload,
    });
  });
}

export type TenderCenterExportViewCode =
  | 'requirements_export_view'
  | 'risks_export_view'
  | 'conflicts_export_view'
  | 'scoring_export_view'
  | 'technical_export_view'
  | 'framework_export_view'
  | 'templates_export_view'
  | 'template_variables_export_view'
  | 'materials_export_view'
  | 'reviews_export_view';

const EXPORT_VIEW_COLUMNS: Record<TenderCenterExportViewCode, readonly string[]> = {
  requirements_export_view: [
    'requirementId',
    'requirementType',
    'title',
    'content',
    'reviewStatus',
    'confidenceScore',
    'sourcePageNo',
  ],
  risks_export_view: ['riskId', 'riskType', 'riskLevel', 'riskTitle', 'sourcePageNo'],
  conflicts_export_view: [
    'conflictId',
    'fieldName',
    'candidateA',
    'candidateB',
    'finalResolution',
    'sourcePageNoA',
    'sourcePageNoB',
  ],
  scoring_export_view: [
    'scoringItemId',
    'scoringCategory',
    'itemName',
    'scoringCriteria',
    'maxScore',
    'sourcePageNo',
  ],
  technical_export_view: [
    'technicalItemId',
    'specCategory',
    'specName',
    'specRequirement',
    'isMandatory',
    'sourcePageNo',
  ],
  framework_export_view: [
    'frameworkNodeId',
    'frameworkNo',
    'frameworkTitle',
    'levelNo',
    'requiredType',
    'generationMode',
    'sourcePageNo',
  ],
  templates_export_view: [
    'templateId',
    'templateName',
    'templateType',
    'fixedFormatFlag',
    'sourcePageNo',
  ],
  template_variables_export_view: [
    'variableId',
    'variableName',
    'requiredFlag',
    'editableFlag',
    'sourcePageNo',
  ],
  materials_export_view: [
    'materialId',
    'materialName',
    'materialType',
    'sourceRequirementId',
    'sourcePageNo',
  ],
  reviews_export_view: ['reviewTaskId', 'reviewStatus', 'reviewReason', 'reviewTime', 'reviewerId'],
};

export function isTenderCenterExportViewCode(value: string): value is TenderCenterExportViewCode {
  return Object.prototype.hasOwnProperty.call(EXPORT_VIEW_COLUMNS, value);
}

export function getTenderCenterExportColumns(view: TenderCenterExportViewCode): readonly string[] {
  return EXPORT_VIEW_COLUMNS[view];
}

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsvText(rows: Record<string, unknown>[], columns: readonly string[]): string {
  const header = columns.join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCsv(row[column])).join(','))
    .join('\n');
  return body ? `${header}\n${body}` : `${header}\n`;
}

/**
 * 招标文件智能审阅中枢 — 38 张主表 Drizzle 定义（对齐 000/110 文档表名与域划分）
 */
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  varchar,
  jsonb,
  index,
  uniqueIndex,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';
import { hubNoteColumns, hubSoftDelete, hubTimestamps } from './common';
import {
  tcHubAiTaskStatusEnum,
  tcHubAssetStatusEnum,
  tcHubAttachmentTypeEnum,
  tcHubBatchStatusEnum,
  tcHubBatchTriggerSourceEnum,
  tcHubBindingTargetTypeEnum,
  tcHubChangeTypeEnum,
  tcHubCommercialTypeEnum,
  tcHubConflictLevelEnum,
  tcHubConflictReviewStatusEnum,
  tcHubConflictTypeEnum,
  tcHubDocumentCategoryEnum,
  tcHubExportModeEnum,
  tcHubExtractStatusEnum,
  tcHubFrameworkBindingTypeEnum,
  tcHubFrameworkContentTypeEnum,
  tcHubGenerationModeEnum,
  tcHubImportanceLevelEnum,
  tcHubMaterialTypeEnum,
  tcHubModelProviderEnum,
  tcHubMoneyTypeEnum,
  tcHubParseStatusEnum,
  tcHubPriorityLevelEnum,
  tcHubQualificationTypeEnum,
  tcHubRequirementTypeEnum,
  tcHubRequiredTypeEnum,
  tcHubResponseTaskStatusEnum,
  tcHubResponseTaskTypeEnum,
  tcHubReviewReasonEnum,
  tcHubReviewResultEnum,
  tcHubReviewStatusEnum,
  tcHubReviewTaskStatusEnum,
  tcHubRiskLevelEnum,
  tcHubRiskResolutionStatusEnum,
  tcHubRiskTypeEnum,
  tcHubRuleHitResultEnum,
  tcHubRuleSeverityLevelEnum,
  tcHubRuleTypeEnum,
  tcHubSectionNodeTypeEnum,
  tcHubSegmentTypeEnum,
  tcHubSnapshotStatusEnum,
  tcHubSnapshotTypeEnum,
  tcHubSubmissionTypeEnum,
  tcHubTechnicalGroupTypeEnum,
  tcHubTechnicalTypeEnum,
  tcHubTemplateBlockTypeEnum,
  tcHubTemplateTypeEnum,
  tcHubTimeNodeTypeEnum,
  tcHubUrgencyLevelEnum,
  tcHubVariableTypeEnum,
  tcHubVersionTypeEnum,
} from './enums';

// ---------------------------------------------------------------------------
// 项目与文档域
// ---------------------------------------------------------------------------

export const tenderProjects = pgTable(
  'tender_project',
  {
    id: serial('id').primaryKey(),
    projectName: text('project_name').notNull(),
    projectCode: text('project_code'),
    tenderMethod: text('tender_method'),
    tendererName: text('tenderer_name'),
    tenderAgentName: text('tender_agent_name'),
    projectBudgetAmount: numeric('project_budget_amount', { precision: 18, scale: 2 }),
    maxPriceAmount: numeric('max_price_amount', { precision: 18, scale: 2 }),
    projectLocation: text('project_location'),
    projectOverview: text('project_overview'),
    fundSource: text('fund_source'),
    businessCategory: text('business_category'),
    industryCategory: text('industry_category'),
    documentLanguage: text('document_language'),
    currentVersionId: integer('current_version_id'),
    parseStatus: tcHubParseStatusEnum('parse_status').notNull().default('not_started'),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    assetStatus: tcHubAssetStatusEnum('asset_status').notNull().default('draft'),
    createdBy: integer('created_by'),
    updatedBy: integer('updated_by'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    codeIdx: uniqueIndex('tender_project_code_uidx').on(t.projectCode),
  })
);

export const tenderProjectVersions = pgTable(
  'tender_project_version',
  {
    id: serial('id').primaryKey(),
    tenderProjectId: integer('tender_project_id')
      .notNull()
      .references(() => tenderProjects.id, { onDelete: 'cascade' }),
    versionNo: text('version_no').notNull(),
    versionType: tcHubVersionTypeEnum('version_type').notNull().default('original'),
    versionLabel: text('version_label'),
    isCurrent: boolean('is_current').notNull().default(false),
    effectiveDate: timestamp('effective_date'),
    sourceNote: text('source_note'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    projVerUid: uniqueIndex('tender_project_version_proj_ver_uidx').on(
      t.tenderProjectId,
      t.versionNo
    ),
    projIdx: index('tender_project_version_project_idx').on(t.tenderProjectId),
  })
);

export const sourceDocuments = pgTable(
  'source_document',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileExt: varchar('file_ext', { length: 32 }),
    mimeType: varchar('mime_type', { length: 128 }),
    fileSize: integer('file_size'),
    storageKey: text('storage_key'),
    checksum: varchar('checksum', { length: 128 }),
    pageCount: integer('page_count'),
    docCategory: tcHubDocumentCategoryEnum('doc_category').notNull().default('tender_document'),
    parseStatus: tcHubParseStatusEnum('parse_status').notNull().default('not_started'),
    textExtractStatus: tcHubExtractStatusEnum('text_extract_status').notNull().default('pending'),
    structureExtractStatus: tcHubExtractStatusEnum('structure_extract_status')
      .notNull()
      .default('pending'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('source_document_version_idx').on(t.tenderProjectVersionId),
  })
);

export const documentParseBatches = pgTable(
  'document_parse_batch',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    batchNo: text('batch_no').notNull(),
    triggerSource: tcHubBatchTriggerSourceEnum('trigger_source').notNull().default('manual'),
    modelProfile: text('model_profile'),
    promptProfile: text('prompt_profile'),
    ruleProfile: text('rule_profile'),
    parseStartedAt: timestamp('parse_started_at'),
    parseFinishedAt: timestamp('parse_finished_at'),
    batchStatus: tcHubBatchStatusEnum('batch_status').notNull().default('queued'),
    operatorId: integer('operator_id'),
    ...hubTimestamps,
  },
  (t) => ({
    verBatchUid: uniqueIndex('document_parse_batch_ver_batch_uidx').on(
      t.tenderProjectVersionId,
      t.batchNo
    ),
    verIdx: index('document_parse_batch_version_idx').on(t.tenderProjectVersionId),
  })
);

export const documentPages = pgTable(
  'document_page',
  {
    id: serial('id').primaryKey(),
    sourceDocumentId: integer('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: 'cascade' }),
    pageNo: integer('page_no').notNull(),
    pageText: text('page_text'),
    pageImageRef: text('page_image_ref'),
    pageTitleGuess: text('page_title_guess'),
    hasTable: boolean('has_table').notNull().default(false),
    hasTemplateBlock: boolean('has_template_block').notNull().default(false),
    hasSignatureBlock: boolean('has_signature_block').notNull().default(false),
    ...hubTimestamps,
  },
  (t) => ({
    docPageUid: uniqueIndex('document_page_doc_page_uidx').on(t.sourceDocumentId, t.pageNo),
    docIdx: index('document_page_document_idx').on(t.sourceDocumentId),
  })
);

export const sourceSegments = pgTable(
  'source_segment',
  {
    id: serial('id').primaryKey(),
    sourceDocumentId: integer('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: 'cascade' }),
    documentPageId: integer('document_page_id').references(() => documentPages.id, {
      onDelete: 'set null',
    }),
    segmentType: tcHubSegmentTypeEnum('segment_type').notNull().default('paragraph'),
    sectionPath: text('section_path'),
    rawText: text('raw_text'),
    normalizedText: text('normalized_text'),
    bboxJson: jsonb('bbox_json'),
    orderNo: integer('order_no').notNull().default(0),
    parentSegmentId: integer('parent_segment_id'),
    isHeading: boolean('is_heading').notNull().default(false),
    headingLevel: integer('heading_level'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    docIdx: index('source_segment_document_idx').on(t.sourceDocumentId),
    pageIdx: index('source_segment_page_idx').on(t.documentPageId),
  })
);

// ---------------------------------------------------------------------------
// 结构与框架域
// ---------------------------------------------------------------------------

export const documentSectionNodes = pgTable(
  'document_section_node',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id'),
    sectionNo: text('section_no'),
    sectionTitle: text('section_title'),
    headingLevel: integer('heading_level'),
    orderNo: integer('order_no').notNull().default(0),
    startPageNo: integer('start_page_no'),
    endPageNo: integer('end_page_no'),
    pathText: text('path_text'),
    nodeType: tcHubSectionNodeTypeEnum('node_type').notNull().default('section'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('document_section_node_version_idx').on(t.tenderProjectVersionId),
    parentIdx: index('document_section_node_parent_idx').on(t.parentId),
  })
);

export const bidFrameworkNodes = pgTable(
  'bid_framework_node',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id'),
    frameworkNo: text('framework_no'),
    frameworkTitle: text('framework_title'),
    levelNo: integer('level_no'),
    orderNo: integer('order_no').notNull().default(0),
    requiredType: tcHubRequiredTypeEnum('required_type').notNull().default('required'),
    contentType: tcHubFrameworkContentTypeEnum('content_type').notNull().default('text'),
    generationMode: tcHubGenerationModeEnum('generation_mode').notNull().default('manual_only'),
    sourceSectionId: integer('source_section_id').references(() => documentSectionNodes.id, {
      onDelete: 'set null',
    }),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('bid_framework_node_version_idx').on(t.tenderProjectVersionId),
  })
);

export const tenderRequirements = pgTable(
  'tender_requirement',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    requirementCode: text('requirement_code'),
    requirementType: tcHubRequirementTypeEnum('requirement_type').notNull(),
    requirementSubtype: text('requirement_subtype'),
    title: text('title'),
    content: text('content'),
    normalizedContent: text('normalized_content'),
    sourceSectionId: integer('source_section_id').references(() => documentSectionNodes.id, {
      onDelete: 'set null',
    }),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    sourcePageNo: integer('source_page_no'),
    importanceLevel: tcHubImportanceLevelEnum('importance_level').notNull().default('medium'),
    riskLevel: tcHubRiskLevelEnum('risk_level').notNull().default('low'),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }),
    extractedByBatchId: integer('extracted_by_batch_id').references(() => documentParseBatches.id, {
      onDelete: 'set null',
    }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    isConflicted: boolean('is_conflicted').notNull().default(false),
    isTemplateRelated: boolean('is_template_related').notNull().default(false),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('tender_requirement_version_idx').on(t.tenderProjectVersionId),
    codeIdx: index('tender_requirement_ver_code_idx').on(
      t.tenderProjectVersionId,
      t.requirementCode
    ),
  })
);

export const frameworkRequirementBindings = pgTable(
  'framework_requirement_binding',
  {
    id: serial('id').primaryKey(),
    bidFrameworkNodeId: integer('bid_framework_node_id')
      .notNull()
      .references(() => bidFrameworkNodes.id, { onDelete: 'cascade' }),
    tenderRequirementId: integer('tender_requirement_id')
      .notNull()
      .references(() => tenderRequirements.id, { onDelete: 'cascade' }),
    bindingType: tcHubFrameworkBindingTypeEnum('binding_type').notNull().default('direct'),
    requiredLevel: text('required_level'),
    note: text('note'),
    ...hubTimestamps,
  },
  (t) => ({
    pairUid: uniqueIndex('framework_req_binding_pair_uidx').on(
      t.bidFrameworkNodeId,
      t.tenderRequirementId
    ),
  })
);

export const attachmentRequirementNodes = pgTable(
  'attachment_requirement_node',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    attachmentName: text('attachment_name').notNull(),
    attachmentNo: text('attachment_no'),
    attachmentType: tcHubAttachmentTypeEnum('attachment_type').notNull().default('other'),
    requiredType: tcHubRequiredTypeEnum('required_type').notNull().default('required'),
    sourceDocumentId: integer('source_document_id').references(() => sourceDocuments.id, {
      onDelete: 'set null',
    }),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('attachment_requirement_node_version_idx').on(t.tenderProjectVersionId),
  })
);

// ---------------------------------------------------------------------------
// 招标要求域（专门化 + 时间节点 / 金额 / 递交）
// ---------------------------------------------------------------------------

export const qualificationRequirements = pgTable(
  'qualification_requirement',
  {
    id: serial('id').primaryKey(),
    tenderRequirementId: integer('tender_requirement_id')
      .notNull()
      .references(() => tenderRequirements.id, { onDelete: 'cascade' }),
    qualificationType: tcHubQualificationTypeEnum('qualification_type').notNull().default('other'),
    subjectScope: text('subject_scope'),
    yearRange: text('year_range'),
    amountRequirement: text('amount_requirement'),
    countRequirement: text('count_requirement'),
    proofMaterialHint: text('proof_material_hint'),
    hardConstraintFlag: boolean('hard_constraint_flag').notNull().default(false),
    ...hubTimestamps,
  },
  (t) => ({
    reqUid: uniqueIndex('qualification_requirement_req_uidx').on(t.tenderRequirementId),
  })
);

export const commercialRequirements = pgTable(
  'commercial_requirement',
  {
    id: serial('id').primaryKey(),
    tenderRequirementId: integer('tender_requirement_id')
      .notNull()
      .references(() => tenderRequirements.id, { onDelete: 'cascade' }),
    commercialType: tcHubCommercialTypeEnum('commercial_type').notNull().default('other'),
    amountText: text('amount_text'),
    amountValue: numeric('amount_value', { precision: 18, scale: 2 }),
    currency: varchar('currency', { length: 16 }),
    deadlineText: text('deadline_text'),
    deadlineTime: timestamp('deadline_time'),
    methodText: text('method_text'),
    penaltyClause: text('penalty_clause'),
    proofMaterialHint: text('proof_material_hint'),
    ...hubTimestamps,
  },
  (t) => ({
    reqUid: uniqueIndex('commercial_requirement_req_uidx').on(t.tenderRequirementId),
  })
);

export const technicalRequirements = pgTable(
  'technical_requirement',
  {
    id: serial('id').primaryKey(),
    tenderRequirementId: integer('tender_requirement_id')
      .notNull()
      .references(() => tenderRequirements.id, { onDelete: 'cascade' }),
    technicalType: tcHubTechnicalTypeEnum('technical_type').notNull().default('other'),
    categoryName: text('category_name'),
    requirementName: text('requirement_name'),
    requirementValue: text('requirement_value'),
    valueType: text('value_type'),
    unit: text('unit'),
    starFlag: boolean('star_flag').notNull().default(false),
    allowDeviationFlag: boolean('allow_deviation_flag').notNull().default(false),
    hardConstraintFlag: boolean('hard_constraint_flag').notNull().default(false),
    proofMaterialHint: text('proof_material_hint'),
    ...hubTimestamps,
  },
  (t) => ({
    reqUid: uniqueIndex('technical_requirement_req_uidx').on(t.tenderRequirementId),
  })
);

export const timeNodes = pgTable(
  'time_node',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    nodeType: tcHubTimeNodeTypeEnum('node_type').notNull().default('other'),
    nodeName: text('node_name'),
    timeText: text('time_text'),
    timeValue: timestamp('time_value'),
    locationText: text('location_text'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('time_node_version_idx').on(t.tenderProjectVersionId),
  })
);

export const moneyTerms = pgTable(
  'money_term',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    moneyType: tcHubMoneyTypeEnum('money_type').notNull().default('other'),
    amountText: text('amount_text'),
    amountValue: numeric('amount_value', { precision: 18, scale: 2 }),
    currency: varchar('currency', { length: 16 }),
    calcRule: text('calc_rule'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('money_term_version_idx').on(t.tenderProjectVersionId),
  })
);

export const submissionRequirements = pgTable(
  'submission_requirement',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    submissionType: tcHubSubmissionTypeEnum('submission_type').notNull().default('document'),
    requirementText: text('requirement_text'),
    copiesText: text('copies_text'),
    submissionLocation: text('submission_location'),
    signatureRequiredFlag: boolean('signature_required_flag').notNull().default(false),
    sealRequiredFlag: boolean('seal_required_flag').notNull().default(false),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('submission_requirement_version_idx').on(t.tenderProjectVersionId),
  })
);

// ---------------------------------------------------------------------------
// 风险与规则域（rule_definitions 需在 risk_item 之前，供 hit_rule_id 引用）
// ---------------------------------------------------------------------------

export const ruleDefinitions = pgTable(
  'rule_definition',
  {
    id: serial('id').primaryKey(),
    ruleCode: text('rule_code').notNull(),
    ruleName: text('rule_name').notNull(),
    ruleType: tcHubRuleTypeEnum('rule_type').notNull().default('expression'),
    ruleCategory: text('rule_category'),
    expressionJson: jsonb('expression_json'),
    severityLevel: tcHubRuleSeverityLevelEnum('severity_level').notNull().default('medium'),
    enabledFlag: boolean('enabled_flag').notNull().default(true),
    applicableIndustry: text('applicable_industry'),
    versionNo: text('version_no'),
    note: text('note'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    codeUid: uniqueIndex('rule_definition_code_uidx').on(t.ruleCode),
  })
);

export const riskItems = pgTable(
  'risk_item',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    relatedRequirementId: integer('related_requirement_id').references(
      () => tenderRequirements.id,
      {
        onDelete: 'set null',
      }
    ),
    riskType: tcHubRiskTypeEnum('risk_type').notNull().default('other'),
    riskTitle: text('risk_title').notNull(),
    riskDescription: text('risk_description'),
    riskLevel: tcHubRiskLevelEnum('risk_level').notNull().default('medium'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    hitRuleId: integer('hit_rule_id').references(() => ruleDefinitions.id, {
      onDelete: 'set null',
    }),
    confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    resolutionStatus: tcHubRiskResolutionStatusEnum('resolution_status').notNull().default('open'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('risk_item_version_idx').on(t.tenderProjectVersionId),
  })
);

export const conflictItems = pgTable(
  'conflict_item',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    conflictType: tcHubConflictTypeEnum('conflict_type').notNull().default('other'),
    fieldName: text('field_name'),
    candidateA: text('candidate_a'),
    candidateB: text('candidate_b'),
    sourceASegmentId: integer('source_a_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    sourceBSegmentId: integer('source_b_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    conflictLevel: tcHubConflictLevelEnum('conflict_level').notNull().default('minor'),
    reviewStatus: tcHubConflictReviewStatusEnum('review_status').notNull().default('open'),
    finalResolution: text('final_resolution'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('conflict_item_version_idx').on(t.tenderProjectVersionId),
  })
);

export const ruleHitRecords = pgTable(
  'rule_hit_record',
  {
    id: serial('id').primaryKey(),
    documentParseBatchId: integer('document_parse_batch_id')
      .notNull()
      .references(() => documentParseBatches.id, { onDelete: 'cascade' }),
    ruleDefinitionId: integer('rule_definition_id')
      .notNull()
      .references(() => ruleDefinitions.id, { onDelete: 'cascade' }),
    targetObjectType: varchar('target_object_type', { length: 64 }).notNull(),
    targetObjectId: integer('target_object_id').notNull(),
    hitResult: tcHubRuleHitResultEnum('hit_result').notNull().default('unknown'),
    hitDetailJson: jsonb('hit_detail_json'),
    severityLevel: tcHubRuleSeverityLevelEnum('severity_level').notNull().default('medium'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    batchIdx: index('rule_hit_record_batch_idx').on(t.documentParseBatchId),
    targetIdx: index('rule_hit_record_target_idx').on(t.targetObjectType, t.targetObjectId),
  })
);

export const confidenceAssessments = pgTable(
  'confidence_assessment',
  {
    id: serial('id').primaryKey(),
    targetObjectType: varchar('target_object_type', { length: 64 }).notNull(),
    targetObjectId: integer('target_object_id').notNull(),
    extractionConfidence: numeric('extraction_confidence', { precision: 5, scale: 4 }),
    businessConfidence: numeric('business_confidence', { precision: 5, scale: 4 }),
    reasonJson: jsonb('reason_json'),
    generatedByBatchId: integer('generated_by_batch_id').references(() => documentParseBatches.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    targetIdx: index('confidence_assessment_target_idx').on(t.targetObjectType, t.targetObjectId),
  })
);

// ---------------------------------------------------------------------------
// 评分与技术域
// ---------------------------------------------------------------------------

export const scoringSchemes = pgTable(
  'scoring_scheme',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    schemeName: text('scheme_name').notNull(),
    totalScore: numeric('total_score', { precision: 8, scale: 2 }),
    businessScore: numeric('business_score', { precision: 8, scale: 2 }),
    technicalScore: numeric('technical_score', { precision: 8, scale: 2 }),
    priceScore: numeric('price_score', { precision: 8, scale: 2 }),
    sourceSectionId: integer('source_section_id').references(() => documentSectionNodes.id, {
      onDelete: 'set null',
    }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('scoring_scheme_version_idx').on(t.tenderProjectVersionId),
  })
);

export const scoringItems = pgTable(
  'scoring_item',
  {
    id: serial('id').primaryKey(),
    scoringSchemeId: integer('scoring_scheme_id')
      .notNull()
      .references(() => scoringSchemes.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id'),
    categoryName: text('category_name'),
    itemName: text('item_name'),
    scoreText: text('score_text'),
    scoreValue: numeric('score_value', { precision: 8, scale: 2 }),
    criteriaText: text('criteria_text'),
    proofMaterialHint: text('proof_material_hint'),
    orderNo: integer('order_no').notNull().default(0),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    schemeIdx: index('scoring_item_scheme_idx').on(t.scoringSchemeId),
  })
);

export const technicalSpecGroups = pgTable(
  'technical_spec_group',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    groupName: text('group_name').notNull(),
    groupType: tcHubTechnicalGroupTypeEnum('group_type').notNull().default('mixed'),
    orderNo: integer('order_no').notNull().default(0),
    sourceSectionId: integer('source_section_id').references(() => documentSectionNodes.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('technical_spec_group_version_idx').on(t.tenderProjectVersionId),
  })
);

export const technicalSpecItems = pgTable(
  'technical_spec_item',
  {
    id: serial('id').primaryKey(),
    technicalSpecGroupId: integer('technical_spec_group_id')
      .notNull()
      .references(() => technicalSpecGroups.id, { onDelete: 'cascade' }),
    specName: text('spec_name'),
    specRequirement: text('spec_requirement'),
    unit: text('unit'),
    valueType: text('value_type'),
    starFlag: boolean('star_flag').notNull().default(false),
    allowDeviationFlag: boolean('allow_deviation_flag').notNull().default(false),
    negativeDeviationForbiddenFlag: boolean('negative_deviation_forbidden_flag')
      .notNull()
      .default(false),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    groupIdx: index('technical_spec_item_group_idx').on(t.technicalSpecGroupId),
  })
);

// ---------------------------------------------------------------------------
// 模板与变量域（中枢 bid_template，与既有 bid_templates 表名区分）
// ---------------------------------------------------------------------------

export const hubBidTemplates = pgTable(
  'bid_template',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    templateName: text('template_name').notNull(),
    templateType: tcHubTemplateTypeEnum('template_type').notNull().default('other'),
    sourceTitle: text('source_title'),
    templateText: text('template_text'),
    templateHtml: text('template_html'),
    templateTableJson: jsonb('template_table_json'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    sourcePageNo: integer('source_page_no'),
    fixedFormatFlag: boolean('fixed_format_flag').notNull().default(false),
    originalFormatRequiredFlag: boolean('original_format_required_flag').notNull().default(false),
    signatureRequiredFlag: boolean('signature_required_flag').notNull().default(false),
    sealRequiredFlag: boolean('seal_required_flag').notNull().default(false),
    dateRequiredFlag: boolean('date_required_flag').notNull().default(false),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('bid_template_hub_version_idx').on(t.tenderProjectVersionId),
  })
);

export const templateBlocks = pgTable(
  'template_block',
  {
    id: serial('id').primaryKey(),
    bidTemplateId: integer('bid_template_id')
      .notNull()
      .references(() => hubBidTemplates.id, { onDelete: 'cascade' }),
    blockType: tcHubTemplateBlockTypeEnum('block_type').notNull().default('paragraph'),
    orderNo: integer('order_no').notNull().default(0),
    blockText: text('block_text'),
    blockTableJson: jsonb('block_table_json'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
  },
  (t) => ({
    tplIdx: index('template_block_template_idx').on(t.bidTemplateId),
  })
);

export const templateVariables = pgTable(
  'template_variable',
  {
    id: serial('id').primaryKey(),
    bidTemplateId: integer('bid_template_id')
      .notNull()
      .references(() => hubBidTemplates.id, { onDelete: 'cascade' }),
    variableName: text('variable_name').notNull(),
    variableLabel: text('variable_label'),
    variableType: tcHubVariableTypeEnum('variable_type').notNull().default('text'),
    requiredFlag: boolean('required_flag').notNull().default(false),
    repeatableFlag: boolean('repeatable_flag').notNull().default(false),
    sourceBlockId: integer('source_block_id').references(() => templateBlocks.id, {
      onDelete: 'set null',
    }),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    defaultValueHint: text('default_value_hint'),
    replacementRule: text('replacement_rule'),
    editableFlag: boolean('editable_flag').notNull().default(true),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
  },
  (t) => ({
    tplIdx: index('template_variable_template_idx').on(t.bidTemplateId),
  })
);

export const templateVariableBindings = pgTable(
  'template_variable_binding',
  {
    id: serial('id').primaryKey(),
    templateVariableId: integer('template_variable_id')
      .notNull()
      .references(() => templateVariables.id, { onDelete: 'cascade' }),
    bindingTargetType: tcHubBindingTargetTypeEnum('binding_target_type').notNull().default('other'),
    bindingKey: text('binding_key'),
    fallbackStrategy: text('fallback_strategy'),
    ...hubNoteColumns,
    ...hubTimestamps,
  },
  (t) => ({
    varIdx: index('template_variable_binding_var_idx').on(t.templateVariableId),
  })
);

export const formTableStructures = pgTable(
  'form_table_structure',
  {
    id: serial('id').primaryKey(),
    bidTemplateId: integer('bid_template_id')
      .notNull()
      .references(() => hubBidTemplates.id, { onDelete: 'cascade' }),
    tableName: text('table_name'),
    rowNo: integer('row_no'),
    colNo: integer('col_no'),
    cellKey: text('cell_key'),
    cellLabel: text('cell_label'),
    cellType: varchar('cell_type', { length: 64 }),
    requiredFlag: boolean('required_flag').notNull().default(false),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
  },
  (t) => ({
    tplIdx: index('form_table_structure_template_idx').on(t.bidTemplateId),
  })
);

// ---------------------------------------------------------------------------
// 材料与任务域
// ---------------------------------------------------------------------------

export const submissionMaterials = pgTable(
  'submission_material',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    materialName: text('material_name').notNull(),
    materialType: tcHubMaterialTypeEnum('material_type').notNull().default('other'),
    requiredFlag: boolean('required_flag').notNull().default(true),
    sourceReason: text('source_reason'),
    relatedRequirementId: integer('related_requirement_id').references(
      () => tenderRequirements.id,
      {
        onDelete: 'set null',
      }
    ),
    relatedScoringItemId: integer('related_scoring_item_id').references(() => scoringItems.id, {
      onDelete: 'set null',
    }),
    relatedTemplateId: integer('related_template_id').references(() => hubBidTemplates.id, {
      onDelete: 'set null',
    }),
    needSignatureFlag: boolean('need_signature_flag').notNull().default(false),
    needSealFlag: boolean('need_seal_flag').notNull().default(false),
    note: text('note'),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('submission_material_version_idx').on(t.tenderProjectVersionId),
  })
);

export const responseTaskItems = pgTable(
  'response_task_item',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    taskType: tcHubResponseTaskTypeEnum('task_type').notNull().default('other'),
    taskTitle: text('task_title').notNull(),
    sourceObjectType: varchar('source_object_type', { length: 64 }),
    sourceObjectId: integer('source_object_id'),
    responsibilityRole: text('responsibility_role'),
    priorityLevel: tcHubPriorityLevelEnum('priority_level').notNull().default('p2'),
    deadlineTime: timestamp('deadline_time'),
    status: tcHubResponseTaskStatusEnum('status').notNull().default('pending'),
    note: text('note'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('response_task_item_version_idx').on(t.tenderProjectVersionId),
  })
);

export const clarificationCandidates = pgTable(
  'clarification_candidate',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    relatedRequirementId: integer('related_requirement_id').references(
      () => tenderRequirements.id,
      {
        onDelete: 'set null',
      }
    ),
    questionTitle: text('question_title').notNull(),
    questionContent: text('question_content'),
    questionReason: text('question_reason'),
    urgencyLevel: tcHubUrgencyLevelEnum('urgency_level').notNull().default('normal'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    reviewStatus: tcHubReviewStatusEnum('review_status').notNull().default('draft'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('clarification_candidate_version_idx').on(t.tenderProjectVersionId),
  })
);

// ---------------------------------------------------------------------------
// AI 与治理域
// ---------------------------------------------------------------------------

export const aiTaskRuns = pgTable(
  'ai_task_run',
  {
    id: serial('id').primaryKey(),
    documentParseBatchId: integer('document_parse_batch_id')
      .notNull()
      .references(() => documentParseBatches.id, { onDelete: 'cascade' }),
    taskType: varchar('task_type', { length: 64 }).notNull(),
    taskName: text('task_name'),
    modelProvider: tcHubModelProviderEnum('model_provider').notNull().default('other'),
    modelName: text('model_name'),
    promptProfile: text('prompt_profile'),
    inputRefJson: jsonb('input_ref_json'),
    outputRefJson: jsonb('output_ref_json'),
    tokenUsage: integer('token_usage'),
    latencyMs: integer('latency_ms'),
    taskStatus: tcHubAiTaskStatusEnum('task_status').notNull().default('queued'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    batchIdx: index('ai_task_run_batch_idx').on(t.documentParseBatchId),
  })
);

export const reviewTasks = pgTable(
  'review_task',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    targetObjectType: varchar('target_object_type', { length: 64 }).notNull(),
    targetObjectId: integer('target_object_id').notNull(),
    reviewReason: tcHubReviewReasonEnum('review_reason').notNull().default('other'),
    assignedTo: integer('assigned_to'),
    reviewStatus: tcHubReviewTaskStatusEnum('review_status').notNull().default('pending'),
    reviewResult: tcHubReviewResultEnum('review_result'),
    finalValueJson: jsonb('final_value_json'),
    comment: text('comment'),
    reviewedAt: timestamp('reviewed_at'),
    ...hubTimestamps,
  },
  (t) => ({
    verIdx: index('review_task_version_idx').on(t.tenderProjectVersionId),
    targetIdx: index('review_task_target_idx').on(t.targetObjectType, t.targetObjectId),
  })
);

export const objectChangeLogs = pgTable(
  'object_change_log',
  {
    id: serial('id').primaryKey(),
    targetObjectType: varchar('target_object_type', { length: 64 }).notNull(),
    targetObjectId: integer('target_object_id').notNull(),
    changeType: tcHubChangeTypeEnum('change_type').notNull(),
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),
    operatorId: integer('operator_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    targetIdx: index('object_change_log_target_idx').on(t.targetObjectType, t.targetObjectId),
    createdIdx: index('object_change_log_created_idx').on(t.createdAt),
  })
);

export const assetExportSnapshots = pgTable(
  'asset_export_snapshot',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    snapshotType: tcHubSnapshotTypeEnum('snapshot_type').notNull().default('full_asset'),
    snapshotStatus: tcHubSnapshotStatusEnum('snapshot_status').notNull().default('draft'),
    exportMode: tcHubExportModeEnum('export_mode').notNull().default('json'),
    snapshotJson: jsonb('snapshot_json'),
    schemaVersion: text('schema_version'),
    exportedAt: timestamp('exported_at'),
    exportedBy: integer('exported_by'),
    ...hubTimestamps,
  },
  (t) => ({
    verIdx: index('asset_export_snapshot_version_idx').on(t.tenderProjectVersionId),
  })
);

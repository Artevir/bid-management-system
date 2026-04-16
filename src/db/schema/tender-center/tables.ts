/**
 * 招标文件智能审阅中枢 — 38 张主表 Drizzle 定义（对齐 000/110 文档表名与域划分）
 * 软删表上的业务唯一约束：使用 uniqueIndex(...).where(is_deleted = false)，与迁移 0004 部分唯一索引一致。
 */
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
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
    assetStatus: tcHubAssetStatusEnum('asset_status').notNull().default('not_generated'),
    createdBy: integer('created_by'),
    updatedBy: integer('updated_by'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    codeIdx: uniqueIndex('tender_project_code_uidx')
      .on(t.projectCode)
      .where(sql`${t.isDeleted} = false`),
    currentVersionIdx: index('tender_project_current_version_idx').on(t.currentVersionId),
    parseStatusIdx: index('tender_project_parse_status_idx').on(t.parseStatus),
    reviewStatusIdx: index('tender_project_review_status_idx').on(t.reviewStatus),
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
    projVerUid: uniqueIndex('tender_project_version_proj_ver_uidx')
      .on(t.tenderProjectId, t.versionNo)
      .where(sql`${t.isDeleted} = false`),
    projectCurrentUid: uniqueIndex('tender_project_version_project_current_uidx')
      .on(t.tenderProjectId)
      .where(sql`${t.isDeleted} = false and ${t.isCurrent} = true`),
    projIdx: index('tender_project_version_project_idx').on(t.tenderProjectId),
    projectCurrentIdx: index('tender_project_version_project_current_idx').on(
      t.tenderProjectId,
      t.isCurrent
    ),
    effectiveDateIdx: index('tender_project_version_effective_date_idx').on(t.effectiveDate),
    versionTypeIdx: index('tender_project_version_type_idx').on(t.versionType),
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
    docCategory: tcHubDocumentCategoryEnum('doc_category').notNull().default('main_document'),
    parseStatus: tcHubParseStatusEnum('parse_status').notNull().default('not_started'),
    textExtractStatus: tcHubExtractStatusEnum('text_extract_status')
      .notNull()
      .default('not_started'),
    structureExtractStatus: tcHubExtractStatusEnum('structure_extract_status')
      .notNull()
      .default('not_started'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verChecksumUid: uniqueIndex('source_document_version_checksum_uidx')
      .on(t.tenderProjectVersionId, t.checksum)
      .where(sql`${t.isDeleted} = false and ${t.checksum} is not null`),
    verIdx: index('source_document_version_idx').on(t.tenderProjectVersionId),
    categoryIdx: index('source_document_category_idx').on(t.docCategory),
    parseStatusIdx: index('source_document_parse_status_idx').on(t.parseStatus),
    checksumIdx: index('source_document_checksum_idx').on(t.checksum),
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
    triggerSource: tcHubBatchTriggerSourceEnum('trigger_source')
      .notNull()
      .default('auto_on_upload'),
    modelProfile: text('model_profile'),
    promptProfile: text('prompt_profile'),
    ruleProfile: text('rule_profile'),
    parseStartedAt: timestamp('parse_started_at'),
    parseFinishedAt: timestamp('parse_finished_at'),
    batchStatus: tcHubBatchStatusEnum('batch_status').notNull().default('queued'),
    operatorId: integer('operator_id'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verBatchUid: uniqueIndex('document_parse_batch_ver_batch_uidx')
      .on(t.tenderProjectVersionId, t.batchNo)
      .where(sql`${t.isDeleted} = false`),
    verIdx: index('document_parse_batch_version_idx').on(t.tenderProjectVersionId),
    statusIdx: index('document_parse_batch_status_idx').on(t.batchStatus),
    createdAtIdx: index('document_parse_batch_created_at_idx').on(t.createdAt),
    modelProfileIdx: index('document_parse_batch_model_profile_idx').on(t.modelProfile),
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
    ...hubSoftDelete,
  },
  (t) => ({
    docPageUid: uniqueIndex('document_page_doc_page_uidx')
      .on(t.sourceDocumentId, t.pageNo)
      .where(sql`${t.isDeleted} = false`),
    docIdx: index('document_page_document_idx').on(t.sourceDocumentId),
    pageNoIdx: index('document_page_page_no_idx').on(t.pageNo),
    hasTableIdx: index('document_page_has_table_idx').on(t.hasTable),
    hasTemplateBlockIdx: index('document_page_has_template_block_idx').on(t.hasTemplateBlock),
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
    parentSegmentId: integer('parent_segment_id').references((): AnyPgColumn => sourceSegments.id, {
      onDelete: 'set null',
    }),
    isHeading: boolean('is_heading').notNull().default(false),
    headingLevel: integer('heading_level'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    pageOrderUid: uniqueIndex('source_segment_page_order_uidx')
      .on(t.documentPageId, t.orderNo)
      .where(sql`${t.isDeleted} = false and ${t.documentPageId} is not null`),
    docIdx: index('source_segment_document_idx').on(t.sourceDocumentId),
    pageIdx: index('source_segment_page_idx').on(t.documentPageId),
    typeIdx: index('source_segment_type_idx').on(t.segmentType),
    sectionPathIdx: index('source_segment_section_path_idx').on(t.sectionPath),
    headingIdx: index('source_segment_heading_idx').on(t.isHeading),
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
    parentId: integer('parent_id').references((): AnyPgColumn => documentSectionNodes.id, {
      onDelete: 'set null',
    }),
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
    versionPathUid: uniqueIndex('document_section_node_version_path_uidx')
      .on(t.tenderProjectVersionId, t.pathText)
      .where(sql`${t.isDeleted} = false and ${t.pathText} is not null`),
    verIdx: index('document_section_node_version_idx').on(t.tenderProjectVersionId),
    parentIdx: index('document_section_node_parent_idx').on(t.parentId),
    headingLevelIdx: index('document_section_node_heading_level_idx').on(t.headingLevel),
    startPageIdx: index('document_section_node_start_page_no_idx').on(t.startPageNo),
    nodeTypeIdx: index('document_section_node_node_type_idx').on(t.nodeType),
    pathTextIdx: index('document_section_node_path_text_idx').on(t.pathText),
  })
);

export const bidFrameworkNodes = pgTable(
  'bid_framework_node',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id').references((): AnyPgColumn => bidFrameworkNodes.id, {
      onDelete: 'set null',
    }),
    frameworkNo: text('framework_no'),
    frameworkTitle: text('framework_title'),
    levelNo: integer('level_no'),
    orderNo: integer('order_no').notNull().default(0),
    requiredType: tcHubRequiredTypeEnum('required_type').notNull().default('required'),
    contentType: tcHubFrameworkContentTypeEnum('content_type').notNull().default('text_chapter'),
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
    frameworkNoParentUid: uniqueIndex('bid_framework_node_ver_no_parent_uidx')
      .on(t.tenderProjectVersionId, t.frameworkNo, t.parentId)
      .where(sql`${t.isDeleted} = false and ${t.frameworkNo} is not null`),
    verIdx: index('bid_framework_node_version_idx').on(t.tenderProjectVersionId),
    parentIdx: index('bid_framework_node_parent_idx').on(t.parentId),
    requiredTypeIdx: index('bid_framework_node_required_type_idx').on(t.requiredType),
    contentTypeIdx: index('bid_framework_node_content_type_idx').on(t.contentType),
    generationModeIdx: index('bid_framework_node_generation_mode_idx').on(t.generationMode),
    reviewStatusIdx: index('bid_framework_node_review_status_idx').on(t.reviewStatus),
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
    typeIdx: index('tender_requirement_type_idx').on(t.requirementType),
    subtypeIdx: index('tender_requirement_subtype_idx').on(t.requirementSubtype),
    sourceSectionIdx: index('tender_requirement_source_section_idx').on(t.sourceSectionId),
    riskLevelIdx: index('tender_requirement_risk_level_idx').on(t.riskLevel),
    importanceLevelIdx: index('tender_requirement_importance_level_idx').on(t.importanceLevel),
    reviewStatusIdx: index('tender_requirement_review_status_idx').on(t.reviewStatus),
    conflictedIdx: index('tender_requirement_conflicted_idx').on(t.isConflicted),
    templateRelatedIdx: index('tender_requirement_template_related_idx').on(t.isTemplateRelated),
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
    ...hubSoftDelete,
  },
  (t) => ({
    pairUid: uniqueIndex('framework_req_binding_pair_uidx')
      .on(t.bidFrameworkNodeId, t.tenderRequirementId, t.bindingType)
      .where(sql`${t.isDeleted} = false`),
    frameworkIdx: index('framework_req_binding_framework_idx').on(t.bidFrameworkNodeId),
    requirementIdx: index('framework_req_binding_requirement_idx').on(t.tenderRequirementId),
    requiredLevelIdx: index('framework_req_binding_required_level_idx').on(t.requiredLevel),
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
    typeIdx: index('attachment_requirement_node_type_idx').on(t.attachmentType),
    documentIdx: index('attachment_requirement_node_document_idx').on(t.sourceDocumentId),
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
    qualificationType: tcHubQualificationTypeEnum('qualification_type')
      .notNull()
      .default('other_qualification'),
    subjectScope: text('subject_scope'),
    yearRange: text('year_range'),
    amountRequirement: text('amount_requirement'),
    countRequirement: text('count_requirement'),
    proofMaterialHint: text('proof_material_hint'),
    hardConstraintFlag: boolean('hard_constraint_flag').notNull().default(false),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    reqUid: uniqueIndex('qualification_requirement_req_uidx')
      .on(t.tenderRequirementId)
      .where(sql`${t.isDeleted} = false`),
    typeIdx: index('qualification_requirement_type_idx').on(t.qualificationType),
    hardConstraintIdx: index('qualification_requirement_hard_constraint_idx').on(
      t.hardConstraintFlag
    ),
    yearRangeIdx: index('qualification_requirement_year_range_idx').on(t.yearRange),
  })
);

export const commercialRequirements = pgTable(
  'commercial_requirement',
  {
    id: serial('id').primaryKey(),
    tenderRequirementId: integer('tender_requirement_id')
      .notNull()
      .references(() => tenderRequirements.id, { onDelete: 'cascade' }),
    commercialType: tcHubCommercialTypeEnum('commercial_type')
      .notNull()
      .default('other_commercial'),
    amountText: text('amount_text'),
    amountValue: numeric('amount_value', { precision: 18, scale: 2 }),
    currency: varchar('currency', { length: 16 }),
    deadlineText: text('deadline_text'),
    deadlineTime: timestamp('deadline_time'),
    methodText: text('method_text'),
    penaltyClause: text('penalty_clause'),
    proofMaterialHint: text('proof_material_hint'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    reqUid: uniqueIndex('commercial_requirement_req_uidx')
      .on(t.tenderRequirementId)
      .where(sql`${t.isDeleted} = false`),
    typeIdx: index('commercial_requirement_type_idx').on(t.commercialType),
    deadlineIdx: index('commercial_requirement_deadline_time_idx').on(t.deadlineTime),
    amountIdx: index('commercial_requirement_amount_value_idx').on(t.amountValue),
  })
);

export const technicalRequirements = pgTable(
  'technical_requirement',
  {
    id: serial('id').primaryKey(),
    tenderRequirementId: integer('tender_requirement_id')
      .notNull()
      .references(() => tenderRequirements.id, { onDelete: 'cascade' }),
    technicalType: tcHubTechnicalTypeEnum('technical_type').notNull().default('other_technical'),
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
    ...hubSoftDelete,
  },
  (t) => ({
    reqUid: uniqueIndex('technical_requirement_req_uidx')
      .on(t.tenderRequirementId)
      .where(sql`${t.isDeleted} = false`),
    typeIdx: index('technical_requirement_type_idx').on(t.technicalType),
    starFlagIdx: index('technical_requirement_star_flag_idx').on(t.starFlag),
    allowDeviationIdx: index('technical_requirement_allow_deviation_idx').on(t.allowDeviationFlag),
    hardConstraintIdx: index('technical_requirement_hard_constraint_idx').on(t.hardConstraintFlag),
  })
);

export const timeNodes = pgTable(
  'time_node',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    nodeType: tcHubTimeNodeTypeEnum('node_type').notNull().default('other_time_node'),
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
    typeIdx: index('time_node_type_idx').on(t.nodeType),
    valueIdx: index('time_node_time_value_idx').on(t.timeValue),
    reviewStatusIdx: index('time_node_review_status_idx').on(t.reviewStatus),
  })
);

export const moneyTerms = pgTable(
  'money_term',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    moneyType: tcHubMoneyTypeEnum('money_type').notNull().default('other_money'),
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
    typeIdx: index('money_term_type_idx').on(t.moneyType),
    amountIdx: index('money_term_amount_value_idx').on(t.amountValue),
    reviewStatusIdx: index('money_term_review_status_idx').on(t.reviewStatus),
  })
);

export const submissionRequirements = pgTable(
  'submission_requirement',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    submissionType: tcHubSubmissionTypeEnum('submission_type')
      .notNull()
      .default('other_submission'),
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
    typeIdx: index('submission_requirement_type_idx').on(t.submissionType),
    signatureFlagIdx: index('submission_requirement_signature_flag_idx').on(
      t.signatureRequiredFlag
    ),
    sealFlagIdx: index('submission_requirement_seal_flag_idx').on(t.sealRequiredFlag),
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
    severityLevel: tcHubRuleSeverityLevelEnum('severity_level').notNull().default('warning'),
    enabledFlag: boolean('enabled_flag').notNull().default(true),
    applicableIndustry: text('applicable_industry'),
    versionNo: text('version_no').notNull().default('v1'),
    note: text('note'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    codeVersionUid: uniqueIndex('rule_definition_code_version_uidx')
      .on(t.ruleCode, t.versionNo)
      .where(sql`${t.isDeleted} = false`),
    codeIdx: index('rule_definition_code_idx').on(t.ruleCode),
    typeIdx: index('rule_definition_type_idx').on(t.ruleType),
    categoryIdx: index('rule_definition_category_idx').on(t.ruleCategory),
    enabledIdx: index('rule_definition_enabled_idx').on(t.enabledFlag),
    industryIdx: index('rule_definition_industry_idx').on(t.applicableIndustry),
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
    riskType: tcHubRiskTypeEnum('risk_type').notNull().default('other_risk'),
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
    resolutionNote: text('resolution_note'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('risk_item_version_idx').on(t.tenderProjectVersionId),
    requirementIdx: index('risk_item_requirement_idx').on(t.relatedRequirementId),
    typeIdx: index('risk_item_type_idx').on(t.riskType),
    levelIdx: index('risk_item_level_idx').on(t.riskLevel),
    reviewStatusIdx: index('risk_item_review_status_idx').on(t.reviewStatus),
    resolutionStatusIdx: index('risk_item_resolution_status_idx').on(t.resolutionStatus),
  })
);

export const conflictItems = pgTable(
  'conflict_item',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    conflictType: tcHubConflictTypeEnum('conflict_type').notNull().default('other_conflict'),
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
    reviewStatus: tcHubConflictReviewStatusEnum('review_status').notNull().default('detected'),
    finalResolution: text('final_resolution'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('conflict_item_version_idx').on(t.tenderProjectVersionId),
    typeIdx: index('conflict_item_type_idx').on(t.conflictType),
    fieldNameIdx: index('conflict_item_field_name_idx').on(t.fieldName),
    levelIdx: index('conflict_item_level_idx').on(t.conflictLevel),
    reviewStatusIdx: index('conflict_item_review_status_idx').on(t.reviewStatus),
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
    hitResult: tcHubRuleHitResultEnum('hit_result').notNull().default('uncertain'),
    hitDetailJson: jsonb('hit_detail_json'),
    severityLevel: tcHubRuleSeverityLevelEnum('severity_level').notNull().default('warning'),
    ...hubTimestamps,
  },
  (t) => ({
    batchIdx: index('rule_hit_record_batch_idx').on(t.documentParseBatchId),
    ruleIdx: index('rule_hit_record_rule_idx').on(t.ruleDefinitionId),
    targetIdx: index('rule_hit_record_target_idx').on(t.targetObjectType, t.targetObjectId),
    severityIdx: index('rule_hit_record_severity_idx').on(t.severityLevel),
    createdAtIdx: index('rule_hit_record_created_at_idx').on(t.createdAt),
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
    ...hubTimestamps,
  },
  (t) => ({
    targetIdx: index('confidence_assessment_target_idx').on(t.targetObjectType, t.targetObjectId),
    batchIdx: index('confidence_assessment_batch_idx').on(t.generatedByBatchId),
    extractionIdx: index('confidence_assessment_extraction_idx').on(t.extractionConfidence),
    businessIdx: index('confidence_assessment_business_idx').on(t.businessConfidence),
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
    reviewStatusIdx: index('scoring_scheme_review_status_idx').on(t.reviewStatus),
  })
);

export const scoringItems = pgTable(
  'scoring_item',
  {
    id: serial('id').primaryKey(),
    scoringSchemeId: integer('scoring_scheme_id')
      .notNull()
      .references(() => scoringSchemes.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id').references((): AnyPgColumn => scoringItems.id, {
      onDelete: 'set null',
    }),
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
    parentIdx: index('scoring_item_parent_idx').on(t.parentId),
    categoryIdx: index('scoring_item_category_idx').on(t.categoryName),
    scoreValueIdx: index('scoring_item_score_value_idx').on(t.scoreValue),
    reviewStatusIdx: index('scoring_item_review_status_idx').on(t.reviewStatus),
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
    typeIdx: index('technical_spec_group_type_idx').on(t.groupType),
    orderNoIdx: index('technical_spec_group_order_no_idx').on(t.orderNo),
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
    starFlagIdx: index('technical_spec_item_star_flag_idx').on(t.starFlag),
    allowDeviationIdx: index('technical_spec_item_allow_deviation_idx').on(t.allowDeviationFlag),
    negativeDeviationForbiddenIdx: index('technical_spec_item_negative_dev_forbidden_idx').on(
      t.negativeDeviationForbiddenFlag
    ),
    reviewStatusIdx: index('technical_spec_item_review_status_idx').on(t.reviewStatus),
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
    templateType: tcHubTemplateTypeEnum('template_type').notNull().default('other_template'),
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
    typeIdx: index('bid_template_hub_type_idx').on(t.templateType),
    fixedFormatIdx: index('bid_template_hub_fixed_format_idx').on(t.fixedFormatFlag),
    originalRequiredIdx: index('bid_template_hub_original_required_idx').on(
      t.originalFormatRequiredFlag
    ),
    reviewStatusIdx: index('bid_template_hub_review_status_idx').on(t.reviewStatus),
  })
);

export const templateBlocks = pgTable(
  'template_block',
  {
    id: serial('id').primaryKey(),
    bidTemplateId: integer('bid_template_id')
      .notNull()
      .references(() => hubBidTemplates.id, { onDelete: 'cascade' }),
    blockType: tcHubTemplateBlockTypeEnum('block_type').notNull().default('text_block'),
    orderNo: integer('order_no').notNull().default(0),
    blockText: text('block_text'),
    blockTableJson: jsonb('block_table_json'),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    templateOrderUid: uniqueIndex('template_block_template_order_uidx')
      .on(t.bidTemplateId, t.orderNo)
      .where(sql`${t.isDeleted} = false`),
    tplIdx: index('template_block_template_idx').on(t.bidTemplateId),
    typeIdx: index('template_block_type_idx').on(t.blockType),
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
    ...hubSoftDelete,
  },
  (t) => ({
    templateVarNameUid: uniqueIndex('template_variable_template_name_uidx')
      .on(t.bidTemplateId, t.variableName)
      .where(sql`${t.isDeleted} = false`),
    tplIdx: index('template_variable_template_idx').on(t.bidTemplateId),
    typeIdx: index('template_variable_type_idx').on(t.variableType),
    requiredIdx: index('template_variable_required_idx').on(t.requiredFlag),
    reviewStatusIdx: index('template_variable_review_status_idx').on(t.reviewStatus),
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
    bindingKey: text('binding_key').notNull(),
    fallbackStrategy: text('fallback_strategy'),
    ...hubNoteColumns,
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    varTargetKeyUid: uniqueIndex('template_var_binding_target_key_uidx')
      .on(t.templateVariableId, t.bindingTargetType, t.bindingKey)
      .where(sql`${t.isDeleted} = false`),
    varIdx: index('template_variable_binding_var_idx').on(t.templateVariableId),
    targetTypeIdx: index('template_variable_binding_target_type_idx').on(t.bindingTargetType),
  })
);

export const formTableStructures = pgTable(
  'form_table_structure',
  {
    id: serial('id').primaryKey(),
    bidTemplateId: integer('bid_template_id')
      .notNull()
      .references(() => hubBidTemplates.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    rowNo: integer('row_no').notNull(),
    colNo: integer('col_no').notNull(),
    cellKey: text('cell_key'),
    cellLabel: text('cell_label'),
    cellType: varchar('cell_type', { length: 64 }),
    requiredFlag: boolean('required_flag').notNull().default(false),
    sourceSegmentId: integer('source_segment_id').references(() => sourceSegments.id, {
      onDelete: 'set null',
    }),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    tableCellUid: uniqueIndex('form_table_structure_cell_uidx')
      .on(t.bidTemplateId, t.tableName, t.rowNo, t.colNo)
      .where(sql`${t.isDeleted} = false`),
    tplIdx: index('form_table_structure_template_idx').on(t.bidTemplateId),
    tableNameIdx: index('form_table_structure_table_name_idx').on(t.tableName),
    requiredIdx: index('form_table_structure_required_idx').on(t.requiredFlag),
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
    materialType: tcHubMaterialTypeEnum('material_type').notNull().default('other_material'),
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
    typeIdx: index('submission_material_type_idx').on(t.materialType),
    requiredIdx: index('submission_material_required_idx').on(t.requiredFlag),
    reviewStatusIdx: index('submission_material_review_status_idx').on(t.reviewStatus),
    signatureIdx: index('submission_material_signature_idx').on(t.needSignatureFlag),
    sealIdx: index('submission_material_seal_idx').on(t.needSealFlag),
  })
);

export const responseTaskItems = pgTable(
  'response_task_item',
  {
    id: serial('id').primaryKey(),
    tenderProjectVersionId: integer('tender_project_version_id')
      .notNull()
      .references(() => tenderProjectVersions.id, { onDelete: 'cascade' }),
    taskType: tcHubResponseTaskTypeEnum('task_type').notNull().default('other_task'),
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
    typeIdx: index('response_task_item_type_idx').on(t.taskType),
    roleIdx: index('response_task_item_role_idx').on(t.responsibilityRole),
    priorityIdx: index('response_task_item_priority_idx').on(t.priorityLevel),
    statusIdx: index('response_task_item_status_idx').on(t.status),
    deadlineIdx: index('response_task_item_deadline_idx').on(t.deadlineTime),
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
    requirementIdx: index('clarification_candidate_requirement_idx').on(t.relatedRequirementId),
    urgencyIdx: index('clarification_candidate_urgency_idx').on(t.urgencyLevel),
    reviewStatusIdx: index('clarification_candidate_review_status_idx').on(t.reviewStatus),
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
    ...hubTimestamps,
  },
  (t) => ({
    batchTaskUid: uniqueIndex('ai_task_run_batch_task_uidx')
      .on(t.documentParseBatchId, t.taskType, t.taskName)
      .where(sql`${t.taskName} is not null`),
    batchIdx: index('ai_task_run_batch_idx').on(t.documentParseBatchId),
    typeIdx: index('ai_task_run_type_idx').on(t.taskType),
    providerIdx: index('ai_task_run_provider_idx').on(t.modelProvider),
    modelIdx: index('ai_task_run_model_idx').on(t.modelName),
    statusIdx: index('ai_task_run_status_idx').on(t.taskStatus),
    createdAtIdx: index('ai_task_run_created_at_idx').on(t.createdAt),
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
    reviewReason: tcHubReviewReasonEnum('review_reason').notNull().default('manual_sampling'),
    assignedTo: integer('assigned_to'),
    reviewStatus: tcHubReviewTaskStatusEnum('review_status').notNull().default('pending_assign'),
    reviewResult: tcHubReviewResultEnum('review_result'),
    finalValueJson: jsonb('final_value_json'),
    comment: text('comment'),
    reviewedAt: timestamp('reviewed_at'),
    ...hubTimestamps,
  },
  (t) => ({
    verIdx: index('review_task_version_idx').on(t.tenderProjectVersionId),
    targetIdx: index('review_task_target_idx').on(t.targetObjectType, t.targetObjectId),
    assignedIdx: index('review_task_assigned_idx').on(t.assignedTo),
    statusIdx: index('review_task_status_idx').on(t.reviewStatus),
    reasonIdx: index('review_task_reason_idx').on(t.reviewReason),
    reviewedAtIdx: index('review_task_reviewed_at_idx').on(t.reviewedAt),
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
    ...hubTimestamps,
  },
  (t) => ({
    targetIdx: index('object_change_log_target_idx').on(t.targetObjectType, t.targetObjectId),
    operatorIdx: index('object_change_log_operator_idx').on(t.operatorId),
    changeTypeIdx: index('object_change_log_change_type_idx').on(t.changeType),
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
    snapshotType: tcHubSnapshotTypeEnum('snapshot_type').notNull().default('full_snapshot'),
    snapshotStatus: tcHubSnapshotStatusEnum('snapshot_status').notNull().default('generating'),
    exportMode: tcHubExportModeEnum('export_mode').notNull().default('internal_consumption'),
    snapshotJson: jsonb('snapshot_json'),
    schemaVersion: text('schema_version'),
    exportedAt: timestamp('exported_at'),
    exportedBy: integer('exported_by'),
    ...hubTimestamps,
    ...hubSoftDelete,
  },
  (t) => ({
    verIdx: index('asset_export_snapshot_version_idx').on(t.tenderProjectVersionId),
    typeIdx: index('asset_export_snapshot_type_idx').on(t.snapshotType),
    schemaVersionIdx: index('asset_export_snapshot_schema_version_idx').on(t.schemaVersion),
    exportedAtIdx: index('asset_export_snapshot_exported_at_idx').on(t.exportedAt),
  })
);

import { pgEnum } from 'drizzle-orm/pg-core';

/** 中枢主表枚举：PostgreSQL 名统一加前缀，避免与历史库枚举冲突 */
export const tcHubParseStatusEnum = pgEnum('tc_hub_parse_status', [
  'not_started',
  'ingesting',
  'parsing',
  'partially_parsed',
  'parsed',
  'parse_failed',
  'archived',
]);

export const tcHubReviewStatusEnum = pgEnum('tc_hub_review_status', [
  'draft',
  'pending_review',
  'reviewing',
  'confirmed',
  'modified',
  'rejected',
  'closed',
]);

export const tcHubAssetStatusEnum = pgEnum('tc_hub_asset_status', [
  'draft',
  'ingesting',
  'ready',
  'partial',
  'error',
]);

export const tcHubVersionTypeEnum = pgEnum('tc_hub_version_type', [
  'original',
  'clarification',
  'amendment',
  'supplement',
  'other',
]);

export const tcHubDocumentCategoryEnum = pgEnum('tc_hub_document_category', [
  'tender_document',
  'clarification',
  'addendum',
  'drawing',
  'attachment',
  'other',
]);

export const tcHubExtractStatusEnum = pgEnum('tc_hub_extract_status', [
  'pending',
  'running',
  'done',
  'failed',
  'skipped',
]);

export const tcHubBatchTriggerSourceEnum = pgEnum('tc_hub_batch_trigger_source', [
  'manual',
  'schedule',
  'api',
  'reparse',
  'system',
]);

export const tcHubBatchStatusEnum = pgEnum('tc_hub_batch_status', [
  'queued',
  'running',
  'partial',
  'succeeded',
  'failed',
  'cancelled',
]);

export const tcHubSegmentTypeEnum = pgEnum('tc_hub_segment_type', [
  'paragraph',
  'heading',
  'table',
  'list',
  'figure',
  'header_footer',
  'other',
]);

export const tcHubSectionNodeTypeEnum = pgEnum('tc_hub_section_node_type', [
  'volume',
  'chapter',
  'section',
  'clause',
  'appendix',
  'other',
]);

export const tcHubFrameworkContentTypeEnum = pgEnum('tc_hub_framework_content_type', [
  'text',
  'table',
  'attachment_placeholder',
  'mixed',
]);

export const tcHubFrameworkBindingTypeEnum = pgEnum('tc_hub_framework_binding_type', [
  'direct',
  'derived',
  'inferred',
]);

export const tcHubAttachmentTypeEnum = pgEnum('tc_hub_attachment_type', [
  'certificate',
  'financial',
  'legal',
  'technical',
  'other',
]);

export const tcHubRequiredTypeEnum = pgEnum('tc_hub_required_type', [
  'required',
  'optional',
  'conditional_required',
]);

export const tcHubGenerationModeEnum = pgEnum('tc_hub_generation_mode', [
  'auto_fill',
  'auto_draft',
  'semi_auto',
  'manual_only',
]);

export const tcHubRequirementTypeEnum = pgEnum('tc_hub_requirement_type', [
  'qualification',
  'commercial',
  'technical',
  'submission',
  'other',
]);

export const tcHubImportanceLevelEnum = pgEnum('tc_hub_importance_level', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const tcHubRiskLevelEnum = pgEnum('tc_hub_risk_level', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const tcHubQualificationTypeEnum = pgEnum('tc_hub_qualification_type', [
  'enterprise',
  'personnel',
  'performance',
  'financial',
  'certificate',
  'other',
]);

export const tcHubCommercialTypeEnum = pgEnum('tc_hub_commercial_type', [
  'price',
  'payment',
  'bond',
  'tax',
  'warranty',
  'other',
]);

export const tcHubTechnicalTypeEnum = pgEnum('tc_hub_technical_type', [
  'parameter',
  'standard',
  'scope',
  'delivery',
  'service',
  'other',
]);

export const tcHubTimeNodeTypeEnum = pgEnum('tc_hub_time_node_type', [
  'register',
  'question',
  'site_visit',
  'submission',
  'open_bid',
  'award',
  'contract',
  'other',
]);

export const tcHubMoneyTypeEnum = pgEnum('tc_hub_money_type', [
  'tender_fee',
  'deposit',
  'performance_bond',
  'payment',
  'penalty',
  'budget',
  'other',
]);

export const tcHubSubmissionTypeEnum = pgEnum('tc_hub_submission_type', [
  'document',
  'electronic',
  'sealed_paper',
  'mixed',
  'other',
]);

export const tcHubRiskTypeEnum = pgEnum('tc_hub_risk_type', [
  'compliance',
  'commercial',
  'technical',
  'legal',
  'schedule',
  'other',
]);

export const tcHubRiskResolutionStatusEnum = pgEnum('tc_hub_risk_resolution_status', [
  'open',
  'acknowledged',
  'mitigated',
  'closed',
  'waived',
]);

export const tcHubConflictTypeEnum = pgEnum('tc_hub_conflict_type', [
  'value_mismatch',
  'time_mismatch',
  'semantic',
  'cross_reference',
  'other',
]);

export const tcHubConflictLevelEnum = pgEnum('tc_hub_conflict_level', [
  'minor',
  'major',
  'critical',
]);

export const tcHubConflictReviewStatusEnum = pgEnum('tc_hub_conflict_review_status', [
  'open',
  'under_review',
  'resolved',
  'accepted_risk',
]);

export const tcHubRuleTypeEnum = pgEnum('tc_hub_rule_type', [
  'expression',
  'keyword',
  'llm',
  'composite',
  'threshold',
]);

export const tcHubRuleSeverityLevelEnum = pgEnum('tc_hub_rule_severity_level', [
  'info',
  'low',
  'medium',
  'high',
  'blocker',
]);

export const tcHubRuleHitResultEnum = pgEnum('tc_hub_rule_hit_result', [
  'pass',
  'warn',
  'fail',
  'unknown',
]);

export const tcHubTechnicalGroupTypeEnum = pgEnum('tc_hub_technical_group_type', [
  'goods',
  'service',
  'engineering',
  'mixed',
]);

export const tcHubTemplateTypeEnum = pgEnum('tc_hub_template_type', [
  'letter',
  'table',
  'checklist',
  'statement',
  'other',
]);

export const tcHubTemplateBlockTypeEnum = pgEnum('tc_hub_template_block_type', [
  'paragraph',
  'table',
  'field',
  'signature',
  'other',
]);

export const tcHubVariableTypeEnum = pgEnum('tc_hub_variable_type', [
  'text',
  'number',
  'date',
  'boolean',
  'enum',
  'rich_text',
]);

export const tcHubBindingTargetTypeEnum = pgEnum('tc_hub_binding_target_type', [
  'requirement',
  'segment',
  'field',
  'other',
]);

export const tcHubMaterialTypeEnum = pgEnum('tc_hub_material_type', [
  'original',
  'copy',
  'scan',
  'stamp',
  'authorization',
  'other',
]);

export const tcHubResponseTaskTypeEnum = pgEnum('tc_hub_response_task_type', [
  'prepare_document',
  'collect_material',
  'internal_review',
  'seal',
  'submit',
  'clarify',
  'other',
]);

export const tcHubResponseTaskStatusEnum = pgEnum('tc_hub_response_task_status', [
  'pending',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
]);

export const tcHubPriorityLevelEnum = pgEnum('tc_hub_priority_level', ['p0', 'p1', 'p2', 'p3']);

export const tcHubUrgencyLevelEnum = pgEnum('tc_hub_urgency_level', [
  'normal',
  'urgent',
  'critical',
]);

export const tcHubModelProviderEnum = pgEnum('tc_hub_model_provider', [
  'openai',
  'anthropic',
  'azure_openai',
  'local',
  'other',
]);

export const tcHubAiTaskStatusEnum = pgEnum('tc_hub_ai_task_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export const tcHubReviewReasonEnum = pgEnum('tc_hub_review_reason', [
  'accuracy',
  'compliance',
  'conflict_resolution',
  'template_binding',
  'other',
]);

export const tcHubReviewTaskStatusEnum = pgEnum('tc_hub_review_task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const tcHubReviewResultEnum = pgEnum('tc_hub_review_result', [
  'approved',
  'rejected',
  'needs_revision',
  'deferred',
]);

export const tcHubChangeTypeEnum = pgEnum('tc_hub_change_type', [
  'create',
  'update',
  'delete',
  'confirm',
  'rollback',
]);

export const tcHubSnapshotTypeEnum = pgEnum('tc_hub_snapshot_type', [
  'full_asset',
  'requirements_only',
  'risks_only',
  'templates_only',
  'custom',
]);

export const tcHubSnapshotStatusEnum = pgEnum('tc_hub_snapshot_status', [
  'draft',
  'building',
  'ready',
  'failed',
  'superseded',
]);

export const tcHubExportModeEnum = pgEnum('tc_hub_export_mode', [
  'json',
  'excel',
  'word',
  'pdf_bundle',
  'other',
]);

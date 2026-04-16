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
  // 030: project review status
  'not_reviewed',
  'partially_reviewed',
  'review_failed',
  // 030: object review status
  'draft',
  'pending_review',
  'reviewing',
  'confirmed',
  'modified',
  'rejected',
  'closed',
]);

export const tcHubAssetStatusEnum = pgEnum('tc_hub_asset_status', [
  // 030 canonical project_asset_status
  'not_generated',
  'generating',
  'generated',
  'partially_confirmed',
  'confirmed',
  'exported',
  'invalidated',
  // legacy compatible values
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
  // 030 canonical document_category
  'main_document',
  'clarification',
  'addendum',
  'attachment',
  'template_attachment',
  'pricing_attachment',
  'drawing_attachment',
  'other',
  // legacy compatibility
  'tender_document',
  'drawing',
]);

export const tcHubDocumentParserTypeEnum = pgEnum('tc_hub_document_parser_type', [
  // 030 document_parser_type
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'unknown',
]);

export const tcHubObjectValidityStatusEnum = pgEnum('tc_hub_object_validity_status', [
  // 030 object_validity_status
  'valid',
  'invalid',
  'superseded',
  'expired',
  'deprecated',
]);

export const tcHubExtractStatusEnum = pgEnum('tc_hub_extract_status', [
  // 030 canonical text/structure extract statuses
  'not_started',
  'extracting',
  'extracted',
  'partially_extracted',
  'extract_failed',
  'structuring',
  'structured',
  'partially_structured',
  'structure_failed',
  // legacy compatibility
  'pending',
  'running',
  'done',
  'failed',
  'skipped',
]);

export const tcHubBatchTriggerSourceEnum = pgEnum('tc_hub_batch_trigger_source', [
  // 030 canonical batch_trigger_source
  'auto_on_upload',
  'manual_reparse',
  'rule_profile_changed',
  'model_profile_changed',
  'repair_reparse',
  // legacy compatibility
  'manual',
  'schedule',
  'api',
  'reparse',
  'system',
]);

export const tcHubBatchStatusEnum = pgEnum('tc_hub_batch_status', [
  'queued',
  'running',
  'partially_succeeded',
  'succeeded',
  'failed',
  'cancelled',
  // legacy compatibility
  'partial',
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
  // 030 canonical framework_content_type
  'text_chapter',
  'template_chapter',
  'form_table_chapter',
  'attachment_chapter',
  'statement_chapter',
  'pricing_chapter',
  'other_chapter',
  // legacy compatibility
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
  // 030 canonical requirement_type
  'basic_info',
  'qualification',
  'commercial',
  'technical',
  'time',
  'money',
  'submission',
  'format',
  'signature',
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
  // 030 canonical qualification_type
  'enterprise_qualification',
  'personnel_qualification',
  'project_experience',
  'financial_requirement',
  'credit_requirement',
  'social_security_requirement',
  'certification_requirement',
  'other_qualification',
  // legacy compatibility
  'enterprise',
  'personnel',
  'performance',
  'financial',
  'certificate',
  'other',
]);

export const tcHubCommercialTypeEnum = pgEnum('tc_hub_commercial_type', [
  // 030 canonical commercial_type
  'bid_bond',
  'performance_bond',
  'document_fee',
  'payment_terms',
  'delivery_period',
  'warranty_period',
  'after_sales_commitment',
  'service_response',
  'penalty_clause',
  'other_commercial',
  // legacy compatibility
  'price',
  'payment',
  'bond',
  'tax',
  'warranty',
  'other',
]);

export const tcHubTechnicalTypeEnum = pgEnum('tc_hub_technical_type', [
  // 030 canonical technical_type
  'functional_requirement',
  'performance_requirement',
  'parameter_requirement',
  'compatibility_requirement',
  'deployment_requirement',
  'security_requirement',
  'interface_requirement',
  'training_requirement',
  'other_technical',
  // legacy compatibility
  'parameter',
  'standard',
  'scope',
  'delivery',
  'service',
  'other',
]);

export const tcHubTimeNodeTypeEnum = pgEnum('tc_hub_time_node_type', [
  // 030 canonical time_node_type
  'document_obtain_deadline',
  'question_deadline',
  'answer_release_time',
  'site_visit_time',
  'bid_submission_deadline',
  'bid_opening_time',
  'bond_deadline',
  'other_time_node',
  // legacy compatibility
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
  // 030 canonical money_type
  'project_budget',
  'max_price',
  'document_fee',
  'bid_bond',
  'performance_bond',
  'penalty_amount',
  'other_money',
  // legacy compatibility
  'tender_fee',
  'deposit',
  'payment',
  'penalty',
  'budget',
  'other',
]);

export const tcHubSubmissionTypeEnum = pgEnum('tc_hub_submission_type', [
  // 030 canonical submission_type
  'paper_copy_requirement',
  'electronic_copy_requirement',
  'submission_method',
  'submission_location',
  'seal_requirement',
  'signature_requirement',
  'packaging_requirement',
  'other_submission',
  // legacy compatibility
  'document',
  'electronic',
  'sealed_paper',
  'mixed',
  'other',
]);

export const tcHubRiskTypeEnum = pgEnum('tc_hub_risk_type', [
  // 030 canonical risk_type
  'bid_rejection_risk',
  'invalid_bid_risk',
  'qualification_risk',
  'timeline_risk',
  'amount_risk',
  'brand_preference_risk',
  'template_risk',
  'framework_risk',
  'technical_deviation_risk',
  'other_risk',
  // legacy compatibility
  'compliance',
  'commercial',
  'technical',
  'legal',
  'schedule',
  'other',
]);

export const tcHubRiskResolutionStatusEnum = pgEnum('tc_hub_risk_resolution_status', [
  'open',
  'in_progress',
  'accepted',
  'mitigated',
  'clarified',
  'closed',
  // legacy compatibility
  'acknowledged',
  'waived',
]);

export const tcHubConflictTypeEnum = pgEnum('tc_hub_conflict_type', [
  // 030 canonical conflict_type
  'time_conflict',
  'money_conflict',
  'qualification_conflict',
  'section_conflict',
  'announcement_vs_body_conflict',
  'template_vs_body_conflict',
  'other_conflict',
  // legacy compatibility
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
  'detected',
  'pending_review',
  'reviewing',
  'resolved',
  'ignored',
  'closed',
  // legacy compatibility
  'open',
  'under_review',
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
  'warning',
  'high',
  'critical',
  // legacy compatibility
  'low',
  'medium',
  'blocker',
]);

export const tcHubRuleHitResultEnum = pgEnum('tc_hub_rule_hit_result', [
  'hit',
  'not_hit',
  'partial_hit',
  'uncertain',
  // legacy compatibility
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
  // 030 canonical template_type
  'bid_letter',
  'legal_representative_certificate',
  'authorization_letter',
  'commitment_letter',
  'pricing_form',
  'commercial_deviation_form',
  'technical_deviation_form',
  'qualification_form',
  'team_form',
  'other_template',
  // legacy compatibility
  'letter',
  'table',
  'checklist',
  'statement',
  'other',
]);

export const tcHubTemplateBlockTypeEnum = pgEnum('tc_hub_template_block_type', [
  'title_block',
  'text_block',
  'table_block',
  'signature',
  'signature_block',
  'note_block',
  // legacy compatibility
  'paragraph',
  'table',
  'field',
  'other',
]);

export const tcHubVariableTypeEnum = pgEnum('tc_hub_variable_type', [
  'text',
  'number',
  'money',
  'date',
  'person_name',
  'organization_name',
  'id_number',
  'phone',
  'address',
  'table_cell',
  'other_variable',
  // legacy compatibility
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
  // 030 canonical material_type
  'license_material',
  'qualification_material',
  'experience_material',
  'personnel_material',
  'authorization_material',
  'commitment_material',
  'pricing_material',
  'response_material',
  'other_material',
  // legacy compatibility
  'original',
  'copy',
  'scan',
  'stamp',
  'authorization',
  'other',
]);

export const tcHubResponseTaskTypeEnum = pgEnum('tc_hub_response_task_type', [
  // 030 canonical response_task_type
  'prepare_material',
  'write_chapter',
  'fill_template',
  'confirm_business_term',
  'confirm_technical_term',
  'prepare_clarification',
  'review_risk',
  'other_task',
  // legacy compatibility
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
  'deepseek',
  'qwen',
  'openai_compatible',
  'hybrid',
  // legacy compatibility
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
  'timeout',
  'cancelled',
  'fallback_succeeded',
]);

export const tcHubReviewReasonEnum = pgEnum('tc_hub_review_reason', [
  // 030 canonical review_reason
  'low_confidence',
  'high_risk',
  'conflict_detected',
  'template_ambiguity',
  'framework_ambiguity',
  'manual_sampling',
  'rule_exception',
  // legacy compatibility
  'accuracy',
  'compliance',
  'conflict_resolution',
  'template_binding',
  'other',
]);

export const tcHubReviewTaskStatusEnum = pgEnum('tc_hub_review_task_status', [
  // 030 canonical review_task_status
  'pending_assign',
  'assigned',
  'reviewing',
  'confirmed',
  'modified',
  'rejected',
  'closed',
  // legacy compatibility
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

export const tcHubReviewResultEnum = pgEnum('tc_hub_review_result', [
  // 030 canonical review_result
  'accepted',
  'accepted_with_modification',
  'rejected',
  'reassigned',
  'deferred',
  // legacy compatibility
  'approved',
  'needs_revision',
]);

export const tcHubChangeTypeEnum = pgEnum('tc_hub_change_type', [
  // 030 canonical change_type
  'created',
  'updated',
  'confirmed',
  'modified',
  'rejected',
  'resolved',
  'closed',
  'exported',
  // legacy compatibility
  'create',
  'update',
  'delete',
  'confirm',
  'rollback',
]);

export const tcHubSnapshotTypeEnum = pgEnum('tc_hub_snapshot_type', [
  // 030 canonical snapshot_type
  'requirements_snapshot',
  'framework_snapshot',
  'templates_snapshot',
  'materials_snapshot',
  'full_snapshot',
  // legacy compatibility
  'full_asset',
  'requirements_only',
  'risks_only',
  'templates_only',
  'custom',
]);

export const tcHubSnapshotStatusEnum = pgEnum('tc_hub_snapshot_status', [
  // 030 canonical snapshot_status
  'generating',
  'generated',
  'published',
  'invalidated',
  // legacy compatibility
  'draft',
  'building',
  'ready',
  'failed',
  'superseded',
]);

export const tcHubExportModeEnum = pgEnum('tc_hub_export_mode', [
  // 030 canonical export_mode
  'internal_consumption',
  'downstream_module',
  'manual_download',
  'api_delivery',
  // legacy compatibility
  'json',
  'excel',
  'word',
  'pdf_bundle',
  'other',
]);

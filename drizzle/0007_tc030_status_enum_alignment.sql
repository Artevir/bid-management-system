-- 030 对齐：状态体系、枚举字典、默认值口径统一（兼容历史值，仅新增不删除）

-- review_status (project/object)
ALTER TYPE "public"."tc_hub_review_status" ADD VALUE IF NOT EXISTS 'not_reviewed';
ALTER TYPE "public"."tc_hub_review_status" ADD VALUE IF NOT EXISTS 'partially_reviewed';
ALTER TYPE "public"."tc_hub_review_status" ADD VALUE IF NOT EXISTS 'review_failed';

-- asset_status
ALTER TYPE "public"."tc_hub_asset_status" ADD VALUE IF NOT EXISTS 'not_generated';
ALTER TYPE "public"."tc_hub_asset_status" ADD VALUE IF NOT EXISTS 'generating';
ALTER TYPE "public"."tc_hub_asset_status" ADD VALUE IF NOT EXISTS 'generated';
ALTER TYPE "public"."tc_hub_asset_status" ADD VALUE IF NOT EXISTS 'partially_confirmed';
ALTER TYPE "public"."tc_hub_asset_status" ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE "public"."tc_hub_asset_status" ADD VALUE IF NOT EXISTS 'exported';
ALTER TYPE "public"."tc_hub_asset_status" ADD VALUE IF NOT EXISTS 'invalidated';

-- document_category
ALTER TYPE "public"."tc_hub_document_category" ADD VALUE IF NOT EXISTS 'main_document';
ALTER TYPE "public"."tc_hub_document_category" ADD VALUE IF NOT EXISTS 'template_attachment';
ALTER TYPE "public"."tc_hub_document_category" ADD VALUE IF NOT EXISTS 'pricing_attachment';
ALTER TYPE "public"."tc_hub_document_category" ADD VALUE IF NOT EXISTS 'drawing_attachment';

-- extract_status
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'not_started';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'extracting';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'extracted';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'partially_extracted';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'extract_failed';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'structuring';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'structured';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'partially_structured';
ALTER TYPE "public"."tc_hub_extract_status" ADD VALUE IF NOT EXISTS 'structure_failed';

-- parse batch
ALTER TYPE "public"."tc_hub_batch_trigger_source" ADD VALUE IF NOT EXISTS 'auto_on_upload';
ALTER TYPE "public"."tc_hub_batch_trigger_source" ADD VALUE IF NOT EXISTS 'manual_reparse';
ALTER TYPE "public"."tc_hub_batch_trigger_source" ADD VALUE IF NOT EXISTS 'rule_profile_changed';
ALTER TYPE "public"."tc_hub_batch_trigger_source" ADD VALUE IF NOT EXISTS 'model_profile_changed';
ALTER TYPE "public"."tc_hub_batch_trigger_source" ADD VALUE IF NOT EXISTS 'repair_reparse';
ALTER TYPE "public"."tc_hub_batch_status" ADD VALUE IF NOT EXISTS 'partially_succeeded';

-- framework content type
ALTER TYPE "public"."tc_hub_framework_content_type" ADD VALUE IF NOT EXISTS 'text_chapter';
ALTER TYPE "public"."tc_hub_framework_content_type" ADD VALUE IF NOT EXISTS 'template_chapter';
ALTER TYPE "public"."tc_hub_framework_content_type" ADD VALUE IF NOT EXISTS 'form_table_chapter';
ALTER TYPE "public"."tc_hub_framework_content_type" ADD VALUE IF NOT EXISTS 'attachment_chapter';
ALTER TYPE "public"."tc_hub_framework_content_type" ADD VALUE IF NOT EXISTS 'statement_chapter';
ALTER TYPE "public"."tc_hub_framework_content_type" ADD VALUE IF NOT EXISTS 'pricing_chapter';
ALTER TYPE "public"."tc_hub_framework_content_type" ADD VALUE IF NOT EXISTS 'other_chapter';

-- requirement type dictionaries
ALTER TYPE "public"."tc_hub_requirement_type" ADD VALUE IF NOT EXISTS 'basic_info';
ALTER TYPE "public"."tc_hub_requirement_type" ADD VALUE IF NOT EXISTS 'time';
ALTER TYPE "public"."tc_hub_requirement_type" ADD VALUE IF NOT EXISTS 'money';
ALTER TYPE "public"."tc_hub_requirement_type" ADD VALUE IF NOT EXISTS 'format';
ALTER TYPE "public"."tc_hub_requirement_type" ADD VALUE IF NOT EXISTS 'signature';

ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'enterprise_qualification';
ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'personnel_qualification';
ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'project_experience';
ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'financial_requirement';
ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'credit_requirement';
ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'social_security_requirement';
ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'certification_requirement';
ALTER TYPE "public"."tc_hub_qualification_type" ADD VALUE IF NOT EXISTS 'other_qualification';

ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'bid_bond';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'performance_bond';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'document_fee';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'payment_terms';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'delivery_period';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'warranty_period';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'after_sales_commitment';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'service_response';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'penalty_clause';
ALTER TYPE "public"."tc_hub_commercial_type" ADD VALUE IF NOT EXISTS 'other_commercial';

ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'functional_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'performance_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'parameter_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'compatibility_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'deployment_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'security_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'interface_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'training_requirement';
ALTER TYPE "public"."tc_hub_technical_type" ADD VALUE IF NOT EXISTS 'other_technical';

ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'document_obtain_deadline';
ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'question_deadline';
ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'answer_release_time';
ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'site_visit_time';
ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'bid_submission_deadline';
ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'bid_opening_time';
ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'bond_deadline';
ALTER TYPE "public"."tc_hub_time_node_type" ADD VALUE IF NOT EXISTS 'other_time_node';

ALTER TYPE "public"."tc_hub_money_type" ADD VALUE IF NOT EXISTS 'project_budget';
ALTER TYPE "public"."tc_hub_money_type" ADD VALUE IF NOT EXISTS 'max_price';
ALTER TYPE "public"."tc_hub_money_type" ADD VALUE IF NOT EXISTS 'document_fee';
ALTER TYPE "public"."tc_hub_money_type" ADD VALUE IF NOT EXISTS 'bid_bond';
ALTER TYPE "public"."tc_hub_money_type" ADD VALUE IF NOT EXISTS 'penalty_amount';
ALTER TYPE "public"."tc_hub_money_type" ADD VALUE IF NOT EXISTS 'other_money';

ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'paper_copy_requirement';
ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'electronic_copy_requirement';
ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'submission_method';
ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'submission_location';
ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'seal_requirement';
ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'signature_requirement';
ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'packaging_requirement';
ALTER TYPE "public"."tc_hub_submission_type" ADD VALUE IF NOT EXISTS 'other_submission';

-- risk/conflict/rule
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'bid_rejection_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'invalid_bid_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'qualification_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'timeline_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'amount_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'brand_preference_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'template_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'framework_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'technical_deviation_risk';
ALTER TYPE "public"."tc_hub_risk_type" ADD VALUE IF NOT EXISTS 'other_risk';

ALTER TYPE "public"."tc_hub_risk_resolution_status" ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE "public"."tc_hub_risk_resolution_status" ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE "public"."tc_hub_risk_resolution_status" ADD VALUE IF NOT EXISTS 'clarified';

ALTER TYPE "public"."tc_hub_conflict_type" ADD VALUE IF NOT EXISTS 'time_conflict';
ALTER TYPE "public"."tc_hub_conflict_type" ADD VALUE IF NOT EXISTS 'money_conflict';
ALTER TYPE "public"."tc_hub_conflict_type" ADD VALUE IF NOT EXISTS 'qualification_conflict';
ALTER TYPE "public"."tc_hub_conflict_type" ADD VALUE IF NOT EXISTS 'section_conflict';
ALTER TYPE "public"."tc_hub_conflict_type" ADD VALUE IF NOT EXISTS 'announcement_vs_body_conflict';
ALTER TYPE "public"."tc_hub_conflict_type" ADD VALUE IF NOT EXISTS 'template_vs_body_conflict';
ALTER TYPE "public"."tc_hub_conflict_type" ADD VALUE IF NOT EXISTS 'other_conflict';

ALTER TYPE "public"."tc_hub_conflict_review_status" ADD VALUE IF NOT EXISTS 'detected';
ALTER TYPE "public"."tc_hub_conflict_review_status" ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE "public"."tc_hub_conflict_review_status" ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE "public"."tc_hub_conflict_review_status" ADD VALUE IF NOT EXISTS 'ignored';
ALTER TYPE "public"."tc_hub_conflict_review_status" ADD VALUE IF NOT EXISTS 'closed';

ALTER TYPE "public"."tc_hub_rule_severity_level" ADD VALUE IF NOT EXISTS 'warning';
ALTER TYPE "public"."tc_hub_rule_severity_level" ADD VALUE IF NOT EXISTS 'critical';

ALTER TYPE "public"."tc_hub_rule_hit_result" ADD VALUE IF NOT EXISTS 'hit';
ALTER TYPE "public"."tc_hub_rule_hit_result" ADD VALUE IF NOT EXISTS 'not_hit';
ALTER TYPE "public"."tc_hub_rule_hit_result" ADD VALUE IF NOT EXISTS 'partial_hit';
ALTER TYPE "public"."tc_hub_rule_hit_result" ADD VALUE IF NOT EXISTS 'uncertain';

-- template/material/task/model
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'bid_letter';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'legal_representative_certificate';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'authorization_letter';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'commitment_letter';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'pricing_form';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'commercial_deviation_form';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'technical_deviation_form';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'qualification_form';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'team_form';
ALTER TYPE "public"."tc_hub_template_type" ADD VALUE IF NOT EXISTS 'other_template';

ALTER TYPE "public"."tc_hub_template_block_type" ADD VALUE IF NOT EXISTS 'title_block';
ALTER TYPE "public"."tc_hub_template_block_type" ADD VALUE IF NOT EXISTS 'text_block';
ALTER TYPE "public"."tc_hub_template_block_type" ADD VALUE IF NOT EXISTS 'table_block';
ALTER TYPE "public"."tc_hub_template_block_type" ADD VALUE IF NOT EXISTS 'signature_block';
ALTER TYPE "public"."tc_hub_template_block_type" ADD VALUE IF NOT EXISTS 'note_block';

ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'money';
ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'person_name';
ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'organization_name';
ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'id_number';
ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'phone';
ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'address';
ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'table_cell';
ALTER TYPE "public"."tc_hub_variable_type" ADD VALUE IF NOT EXISTS 'other_variable';

ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'license_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'qualification_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'experience_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'personnel_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'authorization_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'commitment_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'pricing_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'response_material';
ALTER TYPE "public"."tc_hub_material_type" ADD VALUE IF NOT EXISTS 'other_material';

ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'prepare_material';
ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'write_chapter';
ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'fill_template';
ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'confirm_business_term';
ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'confirm_technical_term';
ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'prepare_clarification';
ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'review_risk';
ALTER TYPE "public"."tc_hub_response_task_type" ADD VALUE IF NOT EXISTS 'other_task';

ALTER TYPE "public"."tc_hub_model_provider" ADD VALUE IF NOT EXISTS 'deepseek';
ALTER TYPE "public"."tc_hub_model_provider" ADD VALUE IF NOT EXISTS 'qwen';
ALTER TYPE "public"."tc_hub_model_provider" ADD VALUE IF NOT EXISTS 'openai_compatible';
ALTER TYPE "public"."tc_hub_model_provider" ADD VALUE IF NOT EXISTS 'hybrid';

ALTER TYPE "public"."tc_hub_ai_task_status" ADD VALUE IF NOT EXISTS 'timeout';
ALTER TYPE "public"."tc_hub_ai_task_status" ADD VALUE IF NOT EXISTS 'fallback_succeeded';

-- governance/snapshot enums
ALTER TYPE "public"."tc_hub_review_reason" ADD VALUE IF NOT EXISTS 'low_confidence';
ALTER TYPE "public"."tc_hub_review_reason" ADD VALUE IF NOT EXISTS 'high_risk';
ALTER TYPE "public"."tc_hub_review_reason" ADD VALUE IF NOT EXISTS 'conflict_detected';
ALTER TYPE "public"."tc_hub_review_reason" ADD VALUE IF NOT EXISTS 'template_ambiguity';
ALTER TYPE "public"."tc_hub_review_reason" ADD VALUE IF NOT EXISTS 'framework_ambiguity';
ALTER TYPE "public"."tc_hub_review_reason" ADD VALUE IF NOT EXISTS 'manual_sampling';
ALTER TYPE "public"."tc_hub_review_reason" ADD VALUE IF NOT EXISTS 'rule_exception';

ALTER TYPE "public"."tc_hub_review_task_status" ADD VALUE IF NOT EXISTS 'pending_assign';
ALTER TYPE "public"."tc_hub_review_task_status" ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE "public"."tc_hub_review_task_status" ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE "public"."tc_hub_review_task_status" ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE "public"."tc_hub_review_task_status" ADD VALUE IF NOT EXISTS 'modified';
ALTER TYPE "public"."tc_hub_review_task_status" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "public"."tc_hub_review_task_status" ADD VALUE IF NOT EXISTS 'closed';

ALTER TYPE "public"."tc_hub_review_result" ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE "public"."tc_hub_review_result" ADD VALUE IF NOT EXISTS 'accepted_with_modification';
ALTER TYPE "public"."tc_hub_review_result" ADD VALUE IF NOT EXISTS 'reassigned';

ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'created';
ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'updated';
ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'modified';
ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE "public"."tc_hub_change_type" ADD VALUE IF NOT EXISTS 'exported';

ALTER TYPE "public"."tc_hub_snapshot_type" ADD VALUE IF NOT EXISTS 'requirements_snapshot';
ALTER TYPE "public"."tc_hub_snapshot_type" ADD VALUE IF NOT EXISTS 'framework_snapshot';
ALTER TYPE "public"."tc_hub_snapshot_type" ADD VALUE IF NOT EXISTS 'templates_snapshot';
ALTER TYPE "public"."tc_hub_snapshot_type" ADD VALUE IF NOT EXISTS 'materials_snapshot';
ALTER TYPE "public"."tc_hub_snapshot_type" ADD VALUE IF NOT EXISTS 'full_snapshot';

ALTER TYPE "public"."tc_hub_snapshot_status" ADD VALUE IF NOT EXISTS 'generating';
ALTER TYPE "public"."tc_hub_snapshot_status" ADD VALUE IF NOT EXISTS 'generated';
ALTER TYPE "public"."tc_hub_snapshot_status" ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE "public"."tc_hub_snapshot_status" ADD VALUE IF NOT EXISTS 'invalidated';

ALTER TYPE "public"."tc_hub_export_mode" ADD VALUE IF NOT EXISTS 'internal_consumption';
ALTER TYPE "public"."tc_hub_export_mode" ADD VALUE IF NOT EXISTS 'downstream_module';
ALTER TYPE "public"."tc_hub_export_mode" ADD VALUE IF NOT EXISTS 'manual_download';
ALTER TYPE "public"."tc_hub_export_mode" ADD VALUE IF NOT EXISTS 'api_delivery';

-- 默认值调整（主表字段口径统一到 030）
ALTER TABLE "tender_project" ALTER COLUMN "asset_status" SET DEFAULT 'not_generated';
ALTER TABLE "source_document" ALTER COLUMN "doc_category" SET DEFAULT 'main_document';
ALTER TABLE "source_document" ALTER COLUMN "text_extract_status" SET DEFAULT 'not_started';
ALTER TABLE "source_document" ALTER COLUMN "structure_extract_status" SET DEFAULT 'not_started';
ALTER TABLE "document_parse_batch" ALTER COLUMN "trigger_source" SET DEFAULT 'auto_on_upload';
ALTER TABLE "bid_framework_node" ALTER COLUMN "content_type" SET DEFAULT 'text_chapter';
ALTER TABLE "qualification_requirement" ALTER COLUMN "qualification_type" SET DEFAULT 'other_qualification';
ALTER TABLE "commercial_requirement" ALTER COLUMN "commercial_type" SET DEFAULT 'other_commercial';
ALTER TABLE "technical_requirement" ALTER COLUMN "technical_type" SET DEFAULT 'other_technical';
ALTER TABLE "time_node" ALTER COLUMN "node_type" SET DEFAULT 'other_time_node';
ALTER TABLE "money_term" ALTER COLUMN "money_type" SET DEFAULT 'other_money';
ALTER TABLE "submission_requirement" ALTER COLUMN "submission_type" SET DEFAULT 'other_submission';
ALTER TABLE "rule_definition" ALTER COLUMN "severity_level" SET DEFAULT 'warning';
ALTER TABLE "risk_item" ALTER COLUMN "risk_type" SET DEFAULT 'other_risk';
ALTER TABLE "conflict_item" ALTER COLUMN "conflict_type" SET DEFAULT 'other_conflict';
ALTER TABLE "conflict_item" ALTER COLUMN "review_status" SET DEFAULT 'detected';
ALTER TABLE "rule_hit_record" ALTER COLUMN "hit_result" SET DEFAULT 'uncertain';
ALTER TABLE "rule_hit_record" ALTER COLUMN "severity_level" SET DEFAULT 'warning';
ALTER TABLE "bid_template" ALTER COLUMN "template_type" SET DEFAULT 'other_template';
ALTER TABLE "template_block" ALTER COLUMN "block_type" SET DEFAULT 'text_block';
ALTER TABLE "submission_material" ALTER COLUMN "material_type" SET DEFAULT 'other_material';
ALTER TABLE "response_task" ALTER COLUMN "task_type" SET DEFAULT 'other_task';
ALTER TABLE "review_task" ALTER COLUMN "review_reason" SET DEFAULT 'manual_sampling';
ALTER TABLE "review_task" ALTER COLUMN "review_status" SET DEFAULT 'pending_assign';
ALTER TABLE "asset_export_snapshot" ALTER COLUMN "snapshot_type" SET DEFAULT 'full_snapshot';
ALTER TABLE "asset_export_snapshot" ALTER COLUMN "snapshot_status" SET DEFAULT 'generating';
ALTER TABLE "asset_export_snapshot" ALTER COLUMN "export_mode" SET DEFAULT 'internal_consumption';

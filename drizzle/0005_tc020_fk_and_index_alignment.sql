-- 020 对齐：主外键与索引补全（不含治理流程改造）

-- =========================
-- 自关联外键补全
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'source_segment_parent_segment_fk'
  ) THEN
    ALTER TABLE "source_segment"
      ADD CONSTRAINT "source_segment_parent_segment_fk"
      FOREIGN KEY ("parent_segment_id")
      REFERENCES "source_segment"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_section_node_parent_fk'
  ) THEN
    ALTER TABLE "document_section_node"
      ADD CONSTRAINT "document_section_node_parent_fk"
      FOREIGN KEY ("parent_id")
      REFERENCES "document_section_node"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bid_framework_node_parent_fk'
  ) THEN
    ALTER TABLE "bid_framework_node"
      ADD CONSTRAINT "bid_framework_node_parent_fk"
      FOREIGN KEY ("parent_id")
      REFERENCES "bid_framework_node"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scoring_item_parent_fk'
  ) THEN
    ALTER TABLE "scoring_item"
      ADD CONSTRAINT "scoring_item_parent_fk"
      FOREIGN KEY ("parent_id")
      REFERENCES "scoring_item"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- =========================
-- 唯一索引重建（软删/业务规则）
-- =========================
DROP INDEX IF EXISTS "tender_project_code_uidx";
CREATE UNIQUE INDEX "tender_project_code_uidx"
  ON "tender_project" ("project_code")
  WHERE "is_deleted" = false;

DROP INDEX IF EXISTS "tender_project_version_proj_ver_uidx";
CREATE UNIQUE INDEX "tender_project_version_proj_ver_uidx"
  ON "tender_project_version" ("tender_project_id", "version_no")
  WHERE "is_deleted" = false;
CREATE UNIQUE INDEX IF NOT EXISTS "tender_project_version_project_current_uidx"
  ON "tender_project_version" ("tender_project_id")
  WHERE "is_deleted" = false AND "is_current" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "source_document_version_checksum_uidx"
  ON "source_document" ("tender_project_version_id", "checksum")
  WHERE "is_deleted" = false AND "checksum" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "source_segment_page_order_uidx"
  ON "source_segment" ("document_page_id", "order_no")
  WHERE "is_deleted" = false AND "document_page_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "document_section_node_version_path_uidx"
  ON "document_section_node" ("tender_project_version_id", "path_text")
  WHERE "is_deleted" = false AND "path_text" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bid_framework_node_ver_no_parent_uidx"
  ON "bid_framework_node" ("tender_project_version_id", "framework_no", "parent_id")
  WHERE "is_deleted" = false AND "framework_no" IS NOT NULL;

DROP INDEX IF EXISTS "framework_req_binding_pair_uidx";
CREATE UNIQUE INDEX "framework_req_binding_pair_uidx"
  ON "framework_requirement_binding" ("bid_framework_node_id", "tender_requirement_id", "binding_type")
  WHERE "is_deleted" = false;

DROP INDEX IF EXISTS "qualification_requirement_req_uidx";
CREATE UNIQUE INDEX "qualification_requirement_req_uidx"
  ON "qualification_requirement" ("tender_requirement_id")
  WHERE "is_deleted" = false;

DROP INDEX IF EXISTS "commercial_requirement_req_uidx";
CREATE UNIQUE INDEX "commercial_requirement_req_uidx"
  ON "commercial_requirement" ("tender_requirement_id")
  WHERE "is_deleted" = false;

DROP INDEX IF EXISTS "technical_requirement_req_uidx";
CREATE UNIQUE INDEX "technical_requirement_req_uidx"
  ON "technical_requirement" ("tender_requirement_id")
  WHERE "is_deleted" = false;

UPDATE "rule_definition" SET "version_no" = 'v1' WHERE "version_no" IS NULL;
ALTER TABLE "rule_definition" ALTER COLUMN "version_no" SET DEFAULT 'v1';
ALTER TABLE "rule_definition" ALTER COLUMN "version_no" SET NOT NULL;
DROP INDEX IF EXISTS "rule_definition_code_uidx";
CREATE UNIQUE INDEX "rule_definition_code_version_uidx"
  ON "rule_definition" ("rule_code", "version_no")
  WHERE "is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "template_block_template_order_uidx"
  ON "template_block" ("bid_template_id", "order_no")
  WHERE "is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "template_variable_template_name_uidx"
  ON "template_variable" ("bid_template_id", "variable_name")
  WHERE "is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "template_var_binding_target_key_uidx"
  ON "template_variable_binding" ("template_variable_id", "binding_target_type", "binding_key")
  WHERE "is_deleted" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "form_table_structure_cell_uidx"
  ON "form_table_structure" ("bid_template_id", "table_name", "row_no", "col_no")
  WHERE "is_deleted" = false;

-- =========================
-- 普通索引补全（按 020 高频链路）
-- =========================
CREATE INDEX IF NOT EXISTS "tender_project_current_version_idx" ON "tender_project" ("current_version_id");
CREATE INDEX IF NOT EXISTS "tender_project_parse_status_idx" ON "tender_project" ("parse_status");
CREATE INDEX IF NOT EXISTS "tender_project_review_status_idx" ON "tender_project" ("review_status");

CREATE INDEX IF NOT EXISTS "tender_project_version_project_current_idx"
  ON "tender_project_version" ("tender_project_id", "is_current");
CREATE INDEX IF NOT EXISTS "tender_project_version_effective_date_idx"
  ON "tender_project_version" ("effective_date");
CREATE INDEX IF NOT EXISTS "tender_project_version_type_idx"
  ON "tender_project_version" ("version_type");

CREATE INDEX IF NOT EXISTS "source_document_category_idx" ON "source_document" ("doc_category");
CREATE INDEX IF NOT EXISTS "source_document_parse_status_idx" ON "source_document" ("parse_status");
CREATE INDEX IF NOT EXISTS "source_document_checksum_idx" ON "source_document" ("checksum");

CREATE INDEX IF NOT EXISTS "document_parse_batch_status_idx" ON "document_parse_batch" ("batch_status");
CREATE INDEX IF NOT EXISTS "document_parse_batch_created_at_idx" ON "document_parse_batch" ("created_at");
CREATE INDEX IF NOT EXISTS "document_parse_batch_model_profile_idx" ON "document_parse_batch" ("model_profile");

CREATE INDEX IF NOT EXISTS "document_page_page_no_idx" ON "document_page" ("page_no");
CREATE INDEX IF NOT EXISTS "document_page_has_table_idx" ON "document_page" ("has_table");
CREATE INDEX IF NOT EXISTS "document_page_has_template_block_idx" ON "document_page" ("has_template_block");

CREATE INDEX IF NOT EXISTS "source_segment_type_idx" ON "source_segment" ("segment_type");
CREATE INDEX IF NOT EXISTS "source_segment_section_path_idx" ON "source_segment" ("section_path");
CREATE INDEX IF NOT EXISTS "source_segment_heading_idx" ON "source_segment" ("is_heading");

CREATE INDEX IF NOT EXISTS "document_section_node_heading_level_idx" ON "document_section_node" ("heading_level");
CREATE INDEX IF NOT EXISTS "document_section_node_start_page_no_idx" ON "document_section_node" ("start_page_no");
CREATE INDEX IF NOT EXISTS "document_section_node_node_type_idx" ON "document_section_node" ("node_type");
CREATE INDEX IF NOT EXISTS "document_section_node_path_text_idx" ON "document_section_node" ("path_text");

CREATE INDEX IF NOT EXISTS "bid_framework_node_parent_idx" ON "bid_framework_node" ("parent_id");
CREATE INDEX IF NOT EXISTS "bid_framework_node_required_type_idx" ON "bid_framework_node" ("required_type");
CREATE INDEX IF NOT EXISTS "bid_framework_node_content_type_idx" ON "bid_framework_node" ("content_type");
CREATE INDEX IF NOT EXISTS "bid_framework_node_generation_mode_idx" ON "bid_framework_node" ("generation_mode");
CREATE INDEX IF NOT EXISTS "bid_framework_node_review_status_idx" ON "bid_framework_node" ("review_status");

CREATE INDEX IF NOT EXISTS "framework_req_binding_framework_idx" ON "framework_requirement_binding" ("bid_framework_node_id");
CREATE INDEX IF NOT EXISTS "framework_req_binding_requirement_idx" ON "framework_requirement_binding" ("tender_requirement_id");
CREATE INDEX IF NOT EXISTS "framework_req_binding_required_level_idx" ON "framework_requirement_binding" ("required_level");

CREATE INDEX IF NOT EXISTS "attachment_requirement_node_type_idx" ON "attachment_requirement_node" ("attachment_type");
CREATE INDEX IF NOT EXISTS "attachment_requirement_node_document_idx" ON "attachment_requirement_node" ("source_document_id");

CREATE INDEX IF NOT EXISTS "tender_requirement_type_idx" ON "tender_requirement" ("requirement_type");
CREATE INDEX IF NOT EXISTS "tender_requirement_subtype_idx" ON "tender_requirement" ("requirement_subtype");
CREATE INDEX IF NOT EXISTS "tender_requirement_source_section_idx" ON "tender_requirement" ("source_section_id");
CREATE INDEX IF NOT EXISTS "tender_requirement_risk_level_idx" ON "tender_requirement" ("risk_level");
CREATE INDEX IF NOT EXISTS "tender_requirement_importance_level_idx" ON "tender_requirement" ("importance_level");
CREATE INDEX IF NOT EXISTS "tender_requirement_review_status_idx" ON "tender_requirement" ("review_status");
CREATE INDEX IF NOT EXISTS "tender_requirement_conflicted_idx" ON "tender_requirement" ("is_conflicted");
CREATE INDEX IF NOT EXISTS "tender_requirement_template_related_idx" ON "tender_requirement" ("is_template_related");

CREATE INDEX IF NOT EXISTS "qualification_requirement_type_idx" ON "qualification_requirement" ("qualification_type");
CREATE INDEX IF NOT EXISTS "qualification_requirement_hard_constraint_idx" ON "qualification_requirement" ("hard_constraint_flag");
CREATE INDEX IF NOT EXISTS "qualification_requirement_year_range_idx" ON "qualification_requirement" ("year_range");

CREATE INDEX IF NOT EXISTS "commercial_requirement_type_idx" ON "commercial_requirement" ("commercial_type");
CREATE INDEX IF NOT EXISTS "commercial_requirement_deadline_time_idx" ON "commercial_requirement" ("deadline_time");
CREATE INDEX IF NOT EXISTS "commercial_requirement_amount_value_idx" ON "commercial_requirement" ("amount_value");

CREATE INDEX IF NOT EXISTS "technical_requirement_type_idx" ON "technical_requirement" ("technical_type");
CREATE INDEX IF NOT EXISTS "technical_requirement_star_flag_idx" ON "technical_requirement" ("star_flag");
CREATE INDEX IF NOT EXISTS "technical_requirement_allow_deviation_idx" ON "technical_requirement" ("allow_deviation_flag");
CREATE INDEX IF NOT EXISTS "technical_requirement_hard_constraint_idx" ON "technical_requirement" ("hard_constraint_flag");

CREATE INDEX IF NOT EXISTS "time_node_type_idx" ON "time_node" ("node_type");
CREATE INDEX IF NOT EXISTS "time_node_time_value_idx" ON "time_node" ("time_value");
CREATE INDEX IF NOT EXISTS "time_node_review_status_idx" ON "time_node" ("review_status");

CREATE INDEX IF NOT EXISTS "money_term_type_idx" ON "money_term" ("money_type");
CREATE INDEX IF NOT EXISTS "money_term_amount_value_idx" ON "money_term" ("amount_value");
CREATE INDEX IF NOT EXISTS "money_term_review_status_idx" ON "money_term" ("review_status");

CREATE INDEX IF NOT EXISTS "submission_requirement_type_idx" ON "submission_requirement" ("submission_type");
CREATE INDEX IF NOT EXISTS "submission_requirement_signature_flag_idx" ON "submission_requirement" ("signature_required_flag");
CREATE INDEX IF NOT EXISTS "submission_requirement_seal_flag_idx" ON "submission_requirement" ("seal_required_flag");

CREATE INDEX IF NOT EXISTS "risk_item_requirement_idx" ON "risk_item" ("related_requirement_id");
CREATE INDEX IF NOT EXISTS "risk_item_type_idx" ON "risk_item" ("risk_type");
CREATE INDEX IF NOT EXISTS "risk_item_level_idx" ON "risk_item" ("risk_level");
CREATE INDEX IF NOT EXISTS "risk_item_review_status_idx" ON "risk_item" ("review_status");
CREATE INDEX IF NOT EXISTS "risk_item_resolution_status_idx" ON "risk_item" ("resolution_status");

CREATE INDEX IF NOT EXISTS "conflict_item_type_idx" ON "conflict_item" ("conflict_type");
CREATE INDEX IF NOT EXISTS "conflict_item_field_name_idx" ON "conflict_item" ("field_name");
CREATE INDEX IF NOT EXISTS "conflict_item_level_idx" ON "conflict_item" ("conflict_level");
CREATE INDEX IF NOT EXISTS "conflict_item_review_status_idx" ON "conflict_item" ("review_status");

CREATE INDEX IF NOT EXISTS "rule_definition_code_idx" ON "rule_definition" ("rule_code");
CREATE INDEX IF NOT EXISTS "rule_definition_type_idx" ON "rule_definition" ("rule_type");
CREATE INDEX IF NOT EXISTS "rule_definition_category_idx" ON "rule_definition" ("rule_category");
CREATE INDEX IF NOT EXISTS "rule_definition_enabled_idx" ON "rule_definition" ("enabled_flag");
CREATE INDEX IF NOT EXISTS "rule_definition_industry_idx" ON "rule_definition" ("applicable_industry");

CREATE INDEX IF NOT EXISTS "rule_hit_record_rule_idx" ON "rule_hit_record" ("rule_definition_id");
CREATE INDEX IF NOT EXISTS "rule_hit_record_severity_idx" ON "rule_hit_record" ("severity_level");
CREATE INDEX IF NOT EXISTS "rule_hit_record_created_at_idx" ON "rule_hit_record" ("created_at");

CREATE INDEX IF NOT EXISTS "confidence_assessment_batch_idx" ON "confidence_assessment" ("generated_by_batch_id");
CREATE INDEX IF NOT EXISTS "confidence_assessment_extraction_idx" ON "confidence_assessment" ("extraction_confidence");
CREATE INDEX IF NOT EXISTS "confidence_assessment_business_idx" ON "confidence_assessment" ("business_confidence");

CREATE INDEX IF NOT EXISTS "scoring_scheme_review_status_idx" ON "scoring_scheme" ("review_status");

CREATE INDEX IF NOT EXISTS "scoring_item_parent_idx" ON "scoring_item" ("parent_id");
CREATE INDEX IF NOT EXISTS "scoring_item_category_idx" ON "scoring_item" ("category_name");
CREATE INDEX IF NOT EXISTS "scoring_item_score_value_idx" ON "scoring_item" ("score_value");
CREATE INDEX IF NOT EXISTS "scoring_item_review_status_idx" ON "scoring_item" ("review_status");

CREATE INDEX IF NOT EXISTS "technical_spec_group_type_idx" ON "technical_spec_group" ("group_type");
CREATE INDEX IF NOT EXISTS "technical_spec_group_order_no_idx" ON "technical_spec_group" ("order_no");

CREATE INDEX IF NOT EXISTS "technical_spec_item_star_flag_idx" ON "technical_spec_item" ("star_flag");
CREATE INDEX IF NOT EXISTS "technical_spec_item_allow_deviation_idx" ON "technical_spec_item" ("allow_deviation_flag");
CREATE INDEX IF NOT EXISTS "technical_spec_item_negative_dev_forbidden_idx"
  ON "technical_spec_item" ("negative_deviation_forbidden_flag");
CREATE INDEX IF NOT EXISTS "technical_spec_item_review_status_idx" ON "technical_spec_item" ("review_status");

CREATE INDEX IF NOT EXISTS "bid_template_hub_type_idx" ON "bid_template" ("template_type");
CREATE INDEX IF NOT EXISTS "bid_template_hub_fixed_format_idx" ON "bid_template" ("fixed_format_flag");
CREATE INDEX IF NOT EXISTS "bid_template_hub_original_required_idx" ON "bid_template" ("original_format_required_flag");
CREATE INDEX IF NOT EXISTS "bid_template_hub_review_status_idx" ON "bid_template" ("review_status");

CREATE INDEX IF NOT EXISTS "template_block_type_idx" ON "template_block" ("block_type");
CREATE INDEX IF NOT EXISTS "template_variable_type_idx" ON "template_variable" ("variable_type");
CREATE INDEX IF NOT EXISTS "template_variable_required_idx" ON "template_variable" ("required_flag");
CREATE INDEX IF NOT EXISTS "template_variable_review_status_idx" ON "template_variable" ("review_status");
CREATE INDEX IF NOT EXISTS "template_variable_binding_target_type_idx"
  ON "template_variable_binding" ("binding_target_type");

CREATE INDEX IF NOT EXISTS "form_table_structure_table_name_idx" ON "form_table_structure" ("table_name");
CREATE INDEX IF NOT EXISTS "form_table_structure_required_idx" ON "form_table_structure" ("required_flag");

CREATE INDEX IF NOT EXISTS "submission_material_type_idx" ON "submission_material" ("material_type");
CREATE INDEX IF NOT EXISTS "submission_material_required_idx" ON "submission_material" ("required_flag");
CREATE INDEX IF NOT EXISTS "submission_material_review_status_idx" ON "submission_material" ("review_status");
CREATE INDEX IF NOT EXISTS "submission_material_signature_idx" ON "submission_material" ("need_signature_flag");
CREATE INDEX IF NOT EXISTS "submission_material_seal_idx" ON "submission_material" ("need_seal_flag");

CREATE INDEX IF NOT EXISTS "response_task_item_type_idx" ON "response_task_item" ("task_type");
CREATE INDEX IF NOT EXISTS "response_task_item_role_idx" ON "response_task_item" ("responsibility_role");
CREATE INDEX IF NOT EXISTS "response_task_item_priority_idx" ON "response_task_item" ("priority_level");
CREATE INDEX IF NOT EXISTS "response_task_item_status_idx" ON "response_task_item" ("status");
CREATE INDEX IF NOT EXISTS "response_task_item_deadline_idx" ON "response_task_item" ("deadline_time");

CREATE INDEX IF NOT EXISTS "clarification_candidate_requirement_idx" ON "clarification_candidate" ("related_requirement_id");
CREATE INDEX IF NOT EXISTS "clarification_candidate_urgency_idx" ON "clarification_candidate" ("urgency_level");
CREATE INDEX IF NOT EXISTS "clarification_candidate_review_status_idx" ON "clarification_candidate" ("review_status");

CREATE INDEX IF NOT EXISTS "ai_task_run_type_idx" ON "ai_task_run" ("task_type");
CREATE UNIQUE INDEX IF NOT EXISTS "ai_task_run_batch_task_uidx"
  ON "ai_task_run" ("document_parse_batch_id", "task_type", "task_name")
  WHERE "task_name" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ai_task_run_provider_idx" ON "ai_task_run" ("model_provider");
CREATE INDEX IF NOT EXISTS "ai_task_run_model_idx" ON "ai_task_run" ("model_name");
CREATE INDEX IF NOT EXISTS "ai_task_run_status_idx" ON "ai_task_run" ("task_status");
CREATE INDEX IF NOT EXISTS "ai_task_run_created_at_idx" ON "ai_task_run" ("created_at");

CREATE INDEX IF NOT EXISTS "review_task_assigned_idx" ON "review_task" ("assigned_to");
CREATE INDEX IF NOT EXISTS "review_task_status_idx" ON "review_task" ("review_status");
CREATE INDEX IF NOT EXISTS "review_task_reason_idx" ON "review_task" ("review_reason");
CREATE INDEX IF NOT EXISTS "review_task_reviewed_at_idx" ON "review_task" ("reviewed_at");

CREATE INDEX IF NOT EXISTS "object_change_log_operator_idx" ON "object_change_log" ("operator_id");
CREATE INDEX IF NOT EXISTS "object_change_log_change_type_idx" ON "object_change_log" ("change_type");

CREATE INDEX IF NOT EXISTS "asset_export_snapshot_type_idx" ON "asset_export_snapshot" ("snapshot_type");
CREATE INDEX IF NOT EXISTS "asset_export_snapshot_schema_version_idx" ON "asset_export_snapshot" ("schema_version");
CREATE INDEX IF NOT EXISTS "asset_export_snapshot_exported_at_idx" ON "asset_export_snapshot" ("exported_at");

-- =========================
-- 全文检索索引（020 第十一章约束）
-- =========================
CREATE INDEX IF NOT EXISTS "source_segment_normalized_text_fts_idx"
  ON "source_segment"
  USING GIN (to_tsvector('simple', coalesce("normalized_text", '')))
  WHERE "is_deleted" = false;

CREATE INDEX IF NOT EXISTS "tender_requirement_normalized_content_fts_idx"
  ON "tender_requirement"
  USING GIN (to_tsvector('simple', coalesce("normalized_content", '')))
  WHERE "is_deleted" = false;

CREATE INDEX IF NOT EXISTS "bid_template_text_fts_idx"
  ON "bid_template"
  USING GIN (to_tsvector('simple', coalesce("template_text", '')))
  WHERE "is_deleted" = false;

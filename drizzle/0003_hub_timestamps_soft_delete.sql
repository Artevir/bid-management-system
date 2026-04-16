-- 010 §8.4 / 工程扩展：补全 updated_at；资格/商务/技术子表与模板子表、快照增加软删列
ALTER TABLE "rule_hit_record" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
UPDATE "rule_hit_record" SET "updated_at" = "created_at";

ALTER TABLE "confidence_assessment" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
UPDATE "confidence_assessment" SET "updated_at" = "created_at";

ALTER TABLE "ai_task_run" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
UPDATE "ai_task_run" SET "updated_at" = "created_at";

ALTER TABLE "object_change_log" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
UPDATE "object_change_log" SET "updated_at" = "created_at";

ALTER TABLE "qualification_requirement" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "qualification_requirement" ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "commercial_requirement" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "commercial_requirement" ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "technical_requirement" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "technical_requirement" ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "template_block" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "template_block" ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "template_variable" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "template_variable" ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "template_variable_binding" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "template_variable_binding" ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "form_table_structure" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "form_table_structure" ADD COLUMN "deleted_at" timestamp;

ALTER TABLE "asset_export_snapshot" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "asset_export_snapshot" ADD COLUMN "deleted_at" timestamp;

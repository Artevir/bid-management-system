-- document_parse_batch / document_page / framework_requirement_binding：软删 + 部分唯一索引（仅 is_deleted = false）
ALTER TABLE "document_parse_batch" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "document_parse_batch" ADD COLUMN "deleted_at" timestamp;

DROP INDEX IF EXISTS "document_parse_batch_ver_batch_uidx";
CREATE UNIQUE INDEX "document_parse_batch_ver_batch_uidx" ON "document_parse_batch" ("tender_project_version_id", "batch_no") WHERE "is_deleted" = false;

ALTER TABLE "document_page" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "document_page" ADD COLUMN "deleted_at" timestamp;

DROP INDEX IF EXISTS "document_page_doc_page_uidx";
CREATE UNIQUE INDEX "document_page_doc_page_uidx" ON "document_page" ("source_document_id", "page_no") WHERE "is_deleted" = false;

ALTER TABLE "framework_requirement_binding" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;
ALTER TABLE "framework_requirement_binding" ADD COLUMN "deleted_at" timestamp;

DROP INDEX IF EXISTS "framework_req_binding_pair_uidx";
CREATE UNIQUE INDEX "framework_req_binding_pair_uidx" ON "framework_requirement_binding" ("bid_framework_node_id", "tender_requirement_id") WHERE "is_deleted" = false;

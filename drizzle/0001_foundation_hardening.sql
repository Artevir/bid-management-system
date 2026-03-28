ALTER TABLE "audit_logs" ADD COLUMN "project_id" integer;

ALTER TABLE "bid_documents" ADD COLUMN "total_generations" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bid_documents" ADD COLUMN "completed_generations" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bid_documents" ADD COLUMN "total_reviews" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bid_documents" ADD COLUMN "completed_reviews" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bid_documents" ADD COLUMN "total_compliance_checks" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bid_documents" ADD COLUMN "passed_compliance_checks" integer DEFAULT 0 NOT NULL;
ALTER TABLE "bid_documents" ADD COLUMN "failed_compliance_checks" integer DEFAULT 0 NOT NULL;

ALTER TABLE "bid_chapters" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;

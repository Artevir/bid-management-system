CREATE TYPE "public"."approval_level" AS ENUM('first', 'second', 'third', 'final');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'returned');--> statement-breakpoint
CREATE TYPE "public"."bid_doc_status" AS ENUM('draft', 'editing', 'reviewing', 'approved', 'rejected', 'published');--> statement-breakpoint
CREATE TYPE "public"."chapter_type" AS ENUM('cover', 'toc', 'business', 'technical', 'qualification', 'price', 'appendix');--> statement-breakpoint
CREATE TYPE "public"."document_security_level" AS ENUM('public', 'internal', 'confidential', 'secret');--> statement-breakpoint
CREATE TYPE "public"."file_category" AS ENUM('tender_doc', 'response_doc', 'reference', 'knowledge', 'template', 'attachment');--> statement-breakpoint
CREATE TYPE "public"."knowledge_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."parse_item_type" AS ENUM('deadline', 'qualification', 'scoring_item', 'technical_param', 'commercial', 'requirement');--> statement-breakpoint
CREATE TYPE "public"."parse_task_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_phase_type" AS ENUM('preparation', 'analysis', 'drafting', 'review', 'submission');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'parsing', 'preparing', 'reviewing', 'approved', 'submitted', 'awarded', 'lost', 'archived');--> statement-breakpoint
CREATE TYPE "public"."prompt_category_type" AS ENUM('technical', 'business', 'qualification', 'proposal', 'summary', 'review', 'custom');--> statement-breakpoint
CREATE TYPE "public"."prompt_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."review_type" AS ENUM('compliance', 'format', 'content', 'completeness');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'locked');--> statement-breakpoint
CREATE TABLE "ai_evaluation_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"test_case_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer NOT NULL,
	"prompt" text,
	"model" varchar(100),
	"generated_content" text,
	"is_accepted" boolean,
	"feedback" text,
	"generated_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_quality_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"metric_value" integer NOT NULL,
	"threshold" integer DEFAULT 70 NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_test_case_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_run_id" integer NOT NULL,
	"test_case_id" integer NOT NULL,
	"case_code" varchar(50) NOT NULL,
	"input" text NOT NULL,
	"actual_output" text,
	"expected_output" text,
	"score" integer,
	"passed" boolean DEFAULT false NOT NULL,
	"latency" integer,
	"token_input" integer,
	"token_output" integer,
	"error_message" text,
	"evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"evaluation_set_id" integer NOT NULL,
	"case_id" varchar(50) NOT NULL,
	"input" text NOT NULL,
	"expected_output" text,
	"criteria" text,
	"weight" integer DEFAULT 1 NOT NULL,
	"tags" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"evaluation_set_id" integer NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"parameters" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"failed_cases" integer DEFAULT 0 NOT NULL,
	"avg_score" integer,
	"avg_latency" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"level" "approval_level" NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"assignee_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"comment" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"flow_id" integer NOT NULL,
	"chapter_id" integer,
	"status" "approval_status" NOT NULL,
	"comment" text,
	"issues" text,
	"reviewer_id" integer NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"username" varchar(50),
	"action" varchar(50) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"resource_id" integer,
	"resource_code" varchar(100),
	"description" text,
	"ip_address" varchar(50),
	"user_agent" text,
	"request_method" varchar(10),
	"request_path" varchar(255),
	"request_params" text,
	"response_status" integer,
	"error_message" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"parent_id" integer,
	"type" "chapter_type",
	"serial_number" varchar(20),
	"title" varchar(300) NOT NULL,
	"content" text,
	"word_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"assigned_to" integer,
	"deadline" timestamp,
	"completed_at" timestamp,
	"response_item_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "bid_doc_status" DEFAULT 'draft' NOT NULL,
	"total_chapters" integer DEFAULT 0 NOT NULL,
	"completed_chapters" integer DEFAULT 0 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_approval_level" "approval_level",
	"deadline" timestamp,
	"published_at" timestamp,
	"published_by" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(50) NOT NULL,
	"category" varchar(50),
	"industry" varchar(50),
	"description" text,
	"content" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bid_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "chapter_template_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(20) DEFAULT '#6366f1',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chapter_template_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "chapter_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(100),
	"description" text,
	"level" integer DEFAULT 1 NOT NULL,
	"content_type" varchar(50) DEFAULT 'text',
	"required" boolean DEFAULT false,
	"content_template" text,
	"placeholders" text,
	"has_children" boolean DEFAULT false,
	"children_config" text,
	"is_system" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"use_count" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chapter_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "competitor_bids" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_id" integer NOT NULL,
	"quote_id" integer,
	"project_name" varchar(200) NOT NULL,
	"tender_code" varchar(100),
	"bid_date" timestamp,
	"quote" text,
	"result" varchar(20),
	"rank" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(50),
	"credit_code" varchar(50),
	"industry" varchar(50),
	"region" varchar(50),
	"address" varchar(255),
	"contact_person" varchar(50),
	"contact_phone" varchar(20),
	"strength" varchar(50),
	"advantages" text,
	"weaknesses" text,
	"total_bids" integer DEFAULT 0 NOT NULL,
	"won_bids" integer DEFAULT 0 NOT NULL,
	"win_rate" text,
	"avg_quote_deviation" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"chapter_id" integer,
	"rule_id" varchar(50),
	"rule_name" varchar(200) NOT NULL,
	"description" text,
	"result" varchar(20) NOT NULL,
	"severity" varchar(20),
	"location" text,
	"suggestion" text,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"contact_type" varchar(50) NOT NULL,
	"contact_date" timestamp NOT NULL,
	"contact_person" varchar(100) NOT NULL,
	"contact_org" varchar(200),
	"our_person" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"result" text,
	"follow_up" text,
	"next_contact_date" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"parent_id" integer,
	"description" text,
	"level" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "doc_framework_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"framework_id" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"parent_id" integer,
	"chapter_code" varchar(50),
	"content_type" varchar(50) DEFAULT 'text',
	"required" boolean DEFAULT false,
	"word_count_min" integer,
	"word_count_max" integer,
	"content_template" text,
	"style_config" text DEFAULT '{}',
	"is_placeholder" boolean DEFAULT false,
	"placeholder_hint" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doc_framework_contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"chapter_id" integer NOT NULL,
	"content" text,
	"word_count" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'pending',
	"generated_by_ai" boolean DEFAULT false,
	"generation_prompt" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doc_framework_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"framework_id" integer NOT NULL,
	"project_id" integer,
	"bid_document_id" integer,
	"name" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'draft',
	"generated_content" text DEFAULT '{}',
	"total_chapters" integer DEFAULT 0,
	"completed_chapters" integer DEFAULT 0,
	"total_words" integer DEFAULT 0,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doc_frameworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(50),
	"description" text,
	"category" varchar(50) DEFAULT 'general',
	"status" varchar(20) DEFAULT 'draft',
	"cover_config" text DEFAULT '{}',
	"title_page_config" text DEFAULT '{}',
	"header_config" text DEFAULT '{}',
	"footer_config" text DEFAULT '{}',
	"toc_config" text DEFAULT '{}',
	"body_config" text DEFAULT '{}',
	"version" integer DEFAULT 1,
	"is_system" boolean DEFAULT false,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "doc_frameworks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "document_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"type" "review_type" NOT NULL,
	"score" integer,
	"result" text,
	"issues" text,
	"suggestion" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"added_by" integer,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"category" "file_category" NOT NULL,
	"description" text,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "file_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_id" integer NOT NULL,
	"version" integer NOT NULL,
	"path" varchar(500) NOT NULL,
	"size" integer NOT NULL,
	"hash" varchar(64),
	"change_log" text,
	"uploader_id" integer NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_by" integer,
	"locked_at" timestamp,
	"lock_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"path" varchar(500) NOT NULL,
	"size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"extension" varchar(20),
	"hash" varchar(64),
	"category_id" integer,
	"security_level" "document_security_level" DEFAULT 'internal' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"uploader_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"project_name" varchar(200) NOT NULL,
	"tender_code" varchar(100),
	"tender_organization" varchar(200),
	"industry" varchar(50),
	"region" varchar(50),
	"project_type" varchar(50),
	"budget" text,
	"our_quote" text NOT NULL,
	"winning_quote" text,
	"avg_quote" text,
	"lowest_quote" text,
	"highest_quote" text,
	"bidder_count" integer,
	"result" varchar(20) NOT NULL,
	"result_rank" integer,
	"score_gap" text,
	"quote_deviation" text,
	"win_probability" text,
	"analysis_notes" text,
	"bid_date" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_approval_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"reviewers" text NOT NULL,
	"require_all_approve" boolean DEFAULT false NOT NULL,
	"min_approvals" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"requester_id" integer NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"total_steps" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_approval_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"reviewer_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"action" varchar(20),
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"acted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "knowledge_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"parent_id" integer,
	"description" text,
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "knowledge_item_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"keywords" text,
	"source" varchar(100),
	"source_url" varchar(500),
	"status" "knowledge_status" DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"embedding_vector" text,
	"author_id" integer NOT NULL,
	"reviewer_id" integer,
	"reviewed_at" timestamp,
	"effective_from" timestamp,
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"code" varchar(50) NOT NULL,
	"color" varchar(20),
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_tags_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "knowledge_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"change_log" text,
	"author_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_minutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"meeting_date" timestamp NOT NULL,
	"participants" text,
	"location" varchar(200),
	"meeting_type" varchar(50),
	"attachments" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text,
	"related_type" varchar(50),
	"related_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parse_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"result_id" integer,
	"type" "parse_item_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"original_text" text,
	"page_number" integer,
	"position" text,
	"confidence" integer DEFAULT 100 NOT NULL,
	"is_low_confidence" boolean DEFAULT false NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_by" integer,
	"confirmed_at" timestamp,
	"extra_data" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parse_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"section_title" varchar(255),
	"section_type" varchar(50),
	"page_number" integer,
	"content" text,
	"summary" text,
	"confidence" integer,
	"raw_result" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parse_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" "parse_task_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total_pages" integer,
	"processed_pages" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(100) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(20) NOT NULL,
	"description" text,
	"parent_id" integer,
	"type" varchar(20) DEFAULT 'menu' NOT NULL,
	"path" varchar(255),
	"method" varchar(10),
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "project_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"file_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" text,
	"added_by" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(20) NOT NULL,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"can_audit" boolean DEFAULT false NOT NULL,
	"can_export" boolean DEFAULT false NOT NULL,
	"max_security_level" "document_security_level" DEFAULT 'internal',
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"invited_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"phase_id" integer,
	"name" varchar(100) NOT NULL,
	"description" text,
	"due_date" timestamp NOT NULL,
	"completed_at" timestamp,
	"completed_by" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"reminder_days" integer DEFAULT 3 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"type" "project_phase_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"completed_at" timestamp,
	"completed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tag_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"added_by" integer,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(20) DEFAULT '#6366f1' NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"phase_id" integer,
	"title" varchar(200) NOT NULL,
	"description" text,
	"assignee_id" integer,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(50) NOT NULL,
	"tender_code" varchar(100),
	"type" varchar(50),
	"industry" varchar(50),
	"region" varchar(50),
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"current_phase_id" integer,
	"tender_organization" varchar(200),
	"tender_agent" varchar(200),
	"tender_method" varchar(50),
	"budget" varchar(100),
	"publish_date" timestamp,
	"register_deadline" timestamp,
	"question_deadline" timestamp,
	"submission_deadline" timestamp,
	"open_bid_date" timestamp,
	"owner_id" integer NOT NULL,
	"department_id" integer NOT NULL,
	"description" text,
	"total_score" integer,
	"completed_score" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"tags" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "prompt_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" "prompt_category_type" DEFAULT 'custom' NOT NULL,
	"description" text,
	"icon" varchar(50),
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "prompt_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"name" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"type" varchar(20) DEFAULT 'text' NOT NULL,
	"default_value" text,
	"options" text,
	"binding_type" varchar(30),
	"binding_field" varchar(100),
	"is_required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_role_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(100) NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"system_prompt" text,
	"model_provider" varchar(50),
	"model_name" varchar(100),
	"temperature" varchar(10),
	"max_tokens" integer,
	"output_format" varchar(50) DEFAULT 'markdown',
	"current_version" integer DEFAULT 1 NOT NULL,
	"status" "prompt_status" DEFAULT 'draft' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"version" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"system_prompt" text,
	"change_log" text,
	"model_provider" varchar(50),
	"model_name" varchar(100),
	"temperature" varchar(10),
	"max_tokens" integer,
	"output_format" varchar(50),
	"author_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(100) NOT NULL,
	"type" varchar(30) NOT NULL,
	"condition" text NOT NULL,
	"advance_days" integer DEFAULT 3 NOT NULL,
	"repeat_days" integer,
	"channels" varchar(50) DEFAULT 'web' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"matrix_id" integer NOT NULL,
	"parse_item_id" integer,
	"type" varchar(30) NOT NULL,
	"serial_number" varchar(50),
	"title" varchar(500) NOT NULL,
	"requirement" text,
	"requirement_type" varchar(30),
	"score" integer,
	"response" text,
	"response_status" varchar(20) DEFAULT 'pending',
	"assignee_id" integer,
	"chapter_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_matrices" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"project_type_id" integer,
	"check_items" text,
	"reviewers" text,
	"min_reviewers" integer DEFAULT 1 NOT NULL,
	"require_all_approve" boolean DEFAULT false NOT NULL,
	"auto_assign" boolean DEFAULT true NOT NULL,
	"max_duration" integer DEFAULT 72 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_report_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"content" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_report_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"report_no" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"type" varchar(50) NOT NULL,
	"score" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"summary" text,
	"issues" text,
	"statistics" text,
	"recommendations" text,
	"exported_at" timestamp,
	"exported_by" integer,
	"exported_format" varchar(20),
	"review_scope" text,
	"review_start_time" timestamp,
	"review_end_time" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_reports_report_no_unique" UNIQUE("report_no")
);
--> statement-breakpoint
CREATE TABLE "review_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"description" text,
	"condition" text NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"auto_fix" boolean DEFAULT false NOT NULL,
	"fix_suggestion" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"config_id" integer,
	"rule_ids" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"granted_by" integer,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name"),
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "scheme_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"template_id" integer,
	"template_version" integer,
	"parameters" text,
	"title" varchar(300),
	"content" text,
	"model_provider" varchar(50),
	"model_name" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"duration" integer,
	"inserted_to_doc" boolean DEFAULT false NOT NULL,
	"doc_path" varchar(500),
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"ip_address" varchar(50),
	"user_agent" text,
	"device_info" varchar(255),
	"expires_at" timestamp NOT NULL,
	"last_accessed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tag_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"icon" varchar(100),
	"color" varchar(20) DEFAULT '#6366f1' NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tag_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "unified_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(100),
	"slug" varchar(150),
	"category_id" integer,
	"parent_id" integer,
	"type" varchar(30) DEFAULT 'tag' NOT NULL,
	"color" varchar(20) DEFAULT '#6366f1' NOT NULL,
	"icon" varchar(100),
	"description" text,
	"entity_types" text,
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"real_name" varchar(50) NOT NULL,
	"phone" varchar(20),
	"avatar" varchar(255),
	"department_id" integer NOT NULL,
	"position" varchar(50),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp,
	"last_login_ip" varchar(50),
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_evaluation_sets" ADD CONSTRAINT "ai_evaluation_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_chapter_id_bid_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."bid_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation_logs" ADD CONSTRAINT "ai_generation_logs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_test_case_results" ADD CONSTRAINT "ai_test_case_results_test_run_id_ai_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."ai_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_test_case_results" ADD CONSTRAINT "ai_test_case_results_test_case_id_ai_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."ai_test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_test_cases" ADD CONSTRAINT "ai_test_cases_evaluation_set_id_ai_evaluation_sets_id_fk" FOREIGN KEY ("evaluation_set_id") REFERENCES "public"."ai_evaluation_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_test_runs" ADD CONSTRAINT "ai_test_runs_evaluation_set_id_ai_evaluation_sets_id_fk" FOREIGN KEY ("evaluation_set_id") REFERENCES "public"."ai_evaluation_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_test_runs" ADD CONSTRAINT "ai_test_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_document_id_bid_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_flow_id_approval_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."approval_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_chapter_id_bid_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."bid_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_chapters" ADD CONSTRAINT "bid_chapters_document_id_bid_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_chapters" ADD CONSTRAINT "bid_chapters_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_chapters" ADD CONSTRAINT "bid_chapters_response_item_id_response_items_id_fk" FOREIGN KEY ("response_item_id") REFERENCES "public"."response_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_documents" ADD CONSTRAINT "bid_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_documents" ADD CONSTRAINT "bid_documents_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_documents" ADD CONSTRAINT "bid_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_templates" ADD CONSTRAINT "bid_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_template_categories" ADD CONSTRAINT "chapter_template_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_templates" ADD CONSTRAINT "chapter_templates_category_id_chapter_template_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."chapter_template_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_templates" ADD CONSTRAINT "chapter_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_bids" ADD CONSTRAINT "competitor_bids_competitor_id_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_bids" ADD CONSTRAINT "competitor_bids_quote_id_historical_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."historical_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_document_id_bid_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_chapter_id_bid_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."bid_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_records" ADD CONSTRAINT "contact_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_records" ADD CONSTRAINT "contact_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_framework_chapters" ADD CONSTRAINT "doc_framework_chapters_framework_id_doc_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."doc_frameworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_framework_contents" ADD CONSTRAINT "doc_framework_contents_instance_id_doc_framework_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."doc_framework_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_framework_contents" ADD CONSTRAINT "doc_framework_contents_chapter_id_doc_framework_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."doc_framework_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_framework_instances" ADD CONSTRAINT "doc_framework_instances_framework_id_doc_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."doc_frameworks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_framework_instances" ADD CONSTRAINT "doc_framework_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_framework_instances" ADD CONSTRAINT "doc_framework_instances_bid_document_id_bid_documents_id_fk" FOREIGN KEY ("bid_document_id") REFERENCES "public"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_framework_instances" ADD CONSTRAINT "doc_framework_instances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doc_frameworks" ADD CONSTRAINT "doc_frameworks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_id_bid_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_unified_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."unified_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_category_id_file_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."file_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_quotes" ADD CONSTRAINT "historical_quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_quotes" ADD CONSTRAINT "historical_quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_approval_configs" ADD CONSTRAINT "knowledge_approval_configs_category_id_knowledge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_approval_requests" ADD CONSTRAINT "knowledge_approval_requests_item_id_knowledge_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_approval_requests" ADD CONSTRAINT "knowledge_approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_approval_steps" ADD CONSTRAINT "knowledge_approval_steps_request_id_knowledge_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."knowledge_approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_approval_steps" ADD CONSTRAINT "knowledge_approval_steps_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_item_tags" ADD CONSTRAINT "knowledge_item_tags_item_id_knowledge_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_item_tags" ADD CONSTRAINT "knowledge_item_tags_tag_id_knowledge_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."knowledge_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_category_id_knowledge_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_item_id_knowledge_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_versions" ADD CONSTRAINT "knowledge_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_items" ADD CONSTRAINT "parse_items_task_id_parse_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."parse_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_items" ADD CONSTRAINT "parse_items_result_id_parse_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."parse_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_items" ADD CONSTRAINT "parse_items_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_results" ADD CONSTRAINT "parse_results_task_id_parse_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."parse_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_tasks" ADD CONSTRAINT "parse_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_tasks" ADD CONSTRAINT "parse_tasks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_tasks" ADD CONSTRAINT "parse_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag_relations" ADD CONSTRAINT "project_tag_relations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag_relations" ADD CONSTRAINT "project_tag_relations_tag_id_project_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."project_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag_relations" ADD CONSTRAINT "project_tag_relations_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_phase_id_project_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parent_id_project_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_parameters" ADD CONSTRAINT "prompt_parameters_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_role_mappings" ADD CONSTRAINT "prompt_role_mappings_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_role_mappings" ADD CONSTRAINT "prompt_role_mappings_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_role_mappings" ADD CONSTRAINT "prompt_role_mappings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_category_id_prompt_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."prompt_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_matrix_id_response_matrices_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "public"."response_matrices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_parse_item_id_parse_items_id_fk" FOREIGN KEY ("parse_item_id") REFERENCES "public"."parse_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_items" ADD CONSTRAINT "response_items_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_matrices" ADD CONSTRAINT "response_matrices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_matrices" ADD CONSTRAINT "response_matrices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_configs" ADD CONSTRAINT "review_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_report_templates" ADD CONSTRAINT "review_report_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_document_id_bid_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."bid_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_rules" ADD CONSTRAINT "review_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_templates" ADD CONSTRAINT "review_templates_config_id_review_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."review_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_templates" ADD CONSTRAINT "review_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_generations" ADD CONSTRAINT "scheme_generations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_generations" ADD CONSTRAINT "scheme_generations_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_generations" ADD CONSTRAINT "scheme_generations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_categories" ADD CONSTRAINT "tag_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_tags" ADD CONSTRAINT "unified_tags_category_id_tag_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tag_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_tags" ADD CONSTRAINT "unified_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_quality_metrics_model_metric_idx" ON "ai_quality_metrics" USING btree ("model_id","category","metric_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_test_case_results_run_case_idx" ON "ai_test_case_results" USING btree ("test_run_id","case_code");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_test_cases_set_case_idx" ON "ai_test_cases" USING btree ("evaluation_set_id","case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_flows_document_level_idx" ON "approval_flows" USING btree ("document_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_chapters_document_parent_idx" ON "bid_chapters" USING btree ("document_id","parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "instance_chapter_unique" ON "doc_framework_contents" USING btree ("instance_id","chapter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_tags_entity_tag_idx" ON "entity_tags" USING btree ("entity_type","entity_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_tags_entity_idx" ON "entity_tags" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_tags_tag_idx" ON "entity_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_versions_file_version_idx" ON "file_versions" USING btree ("file_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_approval_steps_request_step_idx" ON "knowledge_approval_steps" USING btree ("request_id","step_order");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_item_tags_item_tag_idx" ON "knowledge_item_tags" USING btree ("item_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_tags_name_idx" ON "knowledge_tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_versions_item_version_idx" ON "knowledge_versions" USING btree ("item_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE UNIQUE INDEX "parse_results_task_section_idx" ON "parse_results" USING btree ("task_id","page_number","section_title");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_idx" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_resource_action_idx" ON "permissions" USING btree ("resource","action");--> statement-breakpoint
CREATE UNIQUE INDEX "project_files_project_file_idx" ON "project_files" USING btree ("project_id","file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_user_idx" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_tag_relations_project_tag_idx" ON "project_tag_relations" USING btree ("project_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_tags_name_idx" ON "project_tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_parameters_template_param_idx" ON "prompt_parameters" USING btree ("template_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_role_mappings_template_role_idx" ON "prompt_role_mappings" USING btree ("template_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_versions_template_version_idx" ON "prompt_versions" USING btree ("template_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "response_matrices_project_name_idx" ON "response_matrices" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_permission_idx" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_idx" ON "roles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_idx" ON "roles" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unified_tags_name_idx" ON "unified_tags" USING btree ("name","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unified_tags_code_idx" ON "unified_tags" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "unified_tags_slug_idx" ON "unified_tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_idx" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
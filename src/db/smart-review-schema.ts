import { pgTable, text, timestamp, integer, varchar, boolean, serial, uniqueIndex, index, pgEnum, decimal, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, projects } from './schema';

// ============================================
// 智能审阅中枢 - 文档表
// ============================================

export const srDocumentStatusEnum = pgEnum('sr_document_status', [
  'uploading',      // 上传中
  'parsing',        // 解析中
  'parsed',         // 已解析
  'reviewing',      // 审核中
  'approved',       // 已通过
  'rejected',       // 已拒绝
  'archived',       // 已归档
]);

export const srReviewStatusEnum = pgEnum('sr_review_status', [
  'pending',        // 待审核
  'in_progress',   // 审核中
  'approved',       // 已通过
  'rejected',       // 已拒绝
  'needs_revision', // 需要修改
]);

export const srConfidentialityEnum = pgEnum('sr_confidentiality_level', [
  'public',        // 公开
  'internal',      // 内部
  'confidential',  // 机密
  'secret',        // 绝密
]);

export const smartReviewDocuments = pgTable('smart_review_documents', {
  id: serial('id').primaryKey(),
  
  // 文件信息
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileExt: varchar('file_ext', { length: 20 }).notNull(),
  fileSize: integer('file_size'),
  filePageCount: integer('file_page_count'),
  fileMd5: varchar('file_md5', { length: 64 }),
  
  // 项目信息（从文档提取）
  projectName: varchar('project_name', { length: 255 }),
  projectCode: varchar('project_code', { length: 100 }),
  tenderOrganization: varchar('tender_organization', { length: 255 }),
  tenderAgent: varchar('tender_agent', { length: 255 }),
  projectBudget: decimal('project_budget', { precision: 18, scale: 2 }),
  tenderMethod: varchar('tender_method', { length: 50 }),
  tenderScope: text('tender_scope'),
  projectLocation: varchar('project_location', { length: 255 }),
  projectOverview: text('project_overview'),
  fundSource: varchar('fund_source', { length: 255 }),
  
  // 文档状态
  status: srDocumentStatusEnum('status').notNull().default('uploading'),
  parseProgress: integer('parse_progress').default(0),
  parseError: text('parse_error'),
  parseStartedAt: timestamp('parse_started_at'),
  parseCompletedAt: timestamp('parse_completed_at'),
  parseDuration: integer('parse_duration'),
  
  // 提取精度
  extractionAccuracy: integer('extraction_accuracy'),
  extractionConfidence: jsonb('extraction_confidence'),
  
  // 结构化数据（JSON）
  basicInfo: jsonb('basic_info'),
  feeInfo: jsonb('fee_info'),
  timeNodes: jsonb('time_nodes'),
  submissionRequirements: jsonb('submission_requirements'),
  technicalSpecs: jsonb('technical_specs'),
  scoringItems: jsonb('scoring_items'),
  qualificationRequirements: jsonb('qualification_requirements'),
  framework: jsonb('framework'),
  
  // 统计
  specCount: integer('spec_count').default(0),
  scoringCount: integer('scoring_count').default(0),
  chapterCount: integer('chapter_count').default(0),
  
  // 审核状态
  reviewStatus: srReviewStatusEnum('review_status').notNull().default('pending'),
  reviewStartedAt: timestamp('review_started_at'),
  reviewCompletedAt: timestamp('review_completed_at'),
  reviewerId: integer('reviewer_id').references(() => users.id),
  reviewComment: text('review_comment'),
  reviewAccuracy: integer('review_accuracy'),
  
  // 多级审核
  currentApprovalLevel: integer('current_approval_level').default(1),
  approvalLevelRequired: integer('approval_level_required').default(1),
  approvalHistory: jsonb('approval_history'),
  
  // 保密等级
  confidentialityLevel: srConfidentialityEnum('confidentiality_level').default('public'),
  assignedReviewerId: integer('assigned_reviewer_id').references(() => users.id),
  
  // 标签
  tags: jsonb('tags'),
  
  // 过期设置
  expireTime: timestamp('expire_time'),
  
  // 上传者
  uploaderId: integer('uploader_id').notNull().references(() => users.id),
  
  // 关联项目
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  
  // AI处理元数据
  aiModel: varchar('ai_model', { length: 100 }),
  aiPromptVersion: varchar('ai_prompt_version', { length: 20 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  fileMd5Idx: uniqueIndex('sr_doc_md5_idx').on(table.fileMd5),
  statusIdx: index('sr_doc_status_idx').on(table.status),
  reviewStatusIdx: index('sr_doc_review_status_idx').on(table.reviewStatus),
  uploaderIdx: index('sr_doc_uploader_idx').on(table.uploaderId),
  projectIdx: index('sr_doc_project_idx').on(table.projectId),
  createdAtIdx: index('sr_doc_created_at_idx').on(table.createdAt),
}));

// ============================================
// 智能审阅中枢 - 审核记录表
// ============================================

export const smartReviewRecords = pgTable('smart_review_records', {
  id: serial('id').primaryKey(),
  
  documentId: integer('document_id').notNull().references(() => smartReviewDocuments.id, { onDelete: 'cascade' }),
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  
  // 审核级别
  approvalLevel: integer('approval_level').notNull().default(1),
  
  // 审核结果
  status: srReviewStatusEnum('status').notNull(),
  comment: text('comment'),
  accuracy: integer('accuracy'),
  
  // 审核详情
  issuesFound: jsonb('issues_found'),
  suggestions: jsonb('suggestions'),
  
  // 时间
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 智能审阅中枢 - 响应矩阵表
// ============================================

export const smartResponseMatrix = pgTable('smart_response_matrix', {
  id: serial('id').primaryKey(),
  
  documentId: integer('document_id').notNull().references(() => smartReviewDocuments.id, { onDelete: 'cascade' }),
  
  // 矩阵信息
  matrixName: varchar('matrix_name', { length: 255 }).notNull(),
  totalItems: integer('total_items').default(0),
  respondedItems: integer('responded_items').default(0),
  matchRate: integer('match_rate').default(0),
  
  // 状态
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  
  // 生成信息
  generatedBy: varchar('generated_by', { length: 50 }),
  generatedAt: timestamp('generated_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 智能审阅中枢 - 响应矩阵项表
// ============================================

export const smartResponseItems = pgTable('smart_response_items', {
  id: serial('id').primaryKey(),
  
  matrixId: integer('matrix_id').notNull().references(() => smartResponseMatrix.id, { onDelete: 'cascade' }),
  documentId: integer('document_id').notNull().references(() => smartReviewDocuments.id, { onDelete: 'cascade' }),
  
  // 响应项内容
  requirementCategory: varchar('requirement_category', { length: 100 }),
  requirementItem: text('requirement_item').notNull(),
  requirementSource: text('requirement_source'),
  
  // 响应内容
  responseContent: text('response_content'),
  responseSource: text('response_source'),
  confidence: integer('confidence').default(0),
  
  // 匹配状态
  isMatched: boolean('is_matched').default(false),
  matchType: varchar('match_type', { length: 20 }),
  
  // 状态
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 智能审阅中枢 - 审校记录表
// ============================================

export const smartReviewReports = pgTable('smart_review_reports', {
  id: serial('id').primaryKey(),
  
  documentId: integer('document_id').notNull().references(() => smartReviewDocuments.id, { onDelete: 'cascade' }),
  
  // 审校结果
  totalIssues: integer('total_issues').default(0),
  errorCount: integer('error_count').default(0),
  warningCount: integer('warning_count').default(0),
  infoCount: integer('info_count').default(0),
  
  // 覆盖率
  coverageRate: integer('coverage_rate').default(0),
  
  // 审校详情
  issues: jsonb('issues'),
  suggestions: jsonb('suggestions'),
  
  // AI模型
  aiModel: varchar('ai_model', { length: 100 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// Relations
// ============================================

export const smartReviewDocumentsRelations = relations(smartReviewDocuments, ({ one, many }) => ({
  uploader: one(users, {
    fields: [smartReviewDocuments.uploaderId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [smartReviewDocuments.reviewerId],
    references: [users.id],
  }),
  assignedReviewer: one(users, {
    fields: [smartReviewDocuments.assignedReviewerId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [smartReviewDocuments.projectId],
    references: [projects.id],
  }),
  reviewRecords: many(smartReviewRecords),
  responseMatrix: many(smartResponseMatrix),
  reviewReports: many(smartReviewReports),
}));

export const smartReviewRecordsRelations = relations(smartReviewRecords, ({ one }) => ({
  document: one(smartReviewDocuments, {
    fields: [smartReviewRecords.documentId],
    references: [smartReviewDocuments.id],
  }),
  reviewer: one(users, {
    fields: [smartReviewRecords.reviewerId],
    references: [users.id],
  }),
}));

export const smartResponseMatrixRelations = relations(smartResponseMatrix, ({ one, many }) => ({
  document: one(smartReviewDocuments, {
    fields: [smartResponseMatrix.documentId],
    references: [smartReviewDocuments.id],
  }),
  items: many(smartResponseItems),
}));

export const smartResponseItemsRelations = relations(smartResponseItems, ({ one }) => ({
  matrix: one(smartResponseMatrix, {
    fields: [smartResponseItems.matrixId],
    references: [smartResponseMatrix.id],
  }),
  document: one(smartReviewDocuments, {
    fields: [smartResponseItems.documentId],
    references: [smartReviewDocuments.id],
  }),
}));

export const smartReviewReportsRelations = relations(smartReviewReports, ({ one }) => ({
  document: one(smartReviewDocuments, {
    fields: [smartReviewReports.documentId],
    references: [smartReviewDocuments.id],
  }),
}));

// ============================================
// Types
// ============================================

export type SmartReviewDocument = typeof smartReviewDocuments.$inferSelect;
export type NewSmartReviewDocument = typeof smartReviewDocuments.$inferInsert;

export type SmartReviewRecord = typeof smartReviewRecords.$inferSelect;
export type NewSmartReviewRecord = typeof smartReviewRecords.$inferInsert;

export type SmartResponseMatrix = typeof smartResponseMatrix.$inferSelect;
export type NewSmartResponseMatrix = typeof smartResponseMatrix.$inferInsert;

export type SmartResponseItem = typeof smartResponseItems.$inferSelect;
export type NewSmartResponseItem = typeof smartResponseItems.$inferInsert;

export type SmartReviewReport = typeof smartReviewReports.$inferSelect;
export type NewSmartReviewReport = typeof smartReviewReports.$inferInsert;

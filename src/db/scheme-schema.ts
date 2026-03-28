/**
 * 方案库数据库表结构
 * 独立方案管理模块，支持分类、上传、AI生成、框架复用
 */

import { pgTable, serial, varchar, text, integer, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './schema';

// ============================================
// 方案分类枚举
// ============================================

/** 方案阶段枚举 */
export const schemeStageEnum = pgEnum('scheme_stage', [
  'draft',       // 初步方案
  'detailed',    // 详细方案
  'final',       // 最终定稿方案
  'bidding',     // 投标专用方案
]);

/** 方案状态枚举 */
export const schemeStatusEnum = pgEnum('scheme_status', [
  'draft',       // 草稿
  'published',   // 已发布
  'archived',    // 已归档
]);

/** AI生成模式枚举 */
export const aiGenerateModeEnum = pgEnum('ai_generate_mode', [
  'default',     // 系统默认生成
  'llm',         // 调用系统大模型
]);

// ============================================
// 方案分类表
// ============================================

export const schemeCategories = pgTable('scheme_categories', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  description: text('description'),
  
  // 层级结构（最多3级）
  parentId: integer('parent_id').references((): any => schemeCategories.id, { onDelete: 'cascade' }),
  level: integer('level').notNull().default(1), // 1/2/3级
  
  // 分类类型
  type: varchar('type', { length: 50 }), // project_type/stage/custom
  
  // 排序与状态
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  
  // 统计
  schemeCount: integer('scheme_count').notNull().default(0),
  
  // 权限
  viewPermission: varchar('view_permission', { length: 20 }).default('all'), // all/department/self
  editPermission: varchar('edit_permission', { length: 20 }).default('self'), // all/department/self
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 方案标签表
// ============================================

export const schemeTags = pgTable('scheme_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  color: varchar('color', { length: 7 }).default('#6B7280'),
  description: text('description'),
  usageCount: integer('usage_count').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 方案主表
// ============================================

export const schemes = pgTable('schemes', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  description: text('description'),
  
  // 分类与标签
  categoryId: integer('category_id').references(() => schemeCategories.id),
  
  // 方案阶段
  stage: schemeStageEnum('stage').notNull().default('draft'),
  
  // 状态
  status: schemeStatusEnum('status').notNull().default('draft'),
  
  // 内容统计
  totalChapters: integer('total_chapters').notNull().default(0),
  completedChapters: integer('completed_chapters').notNull().default(0),
  wordCount: integer('word_count').notNull().default(0),
  progress: integer('progress').notNull().default(0),
  
  // 文档框架
  frameworkId: integer('framework_id'), // 关联文档框架
  
  // 来源信息
  source: varchar('source', { length: 20 }).notNull().default('manual'), // manual/upload/ai_generate
  sourceFileId: integer('source_file_id'), // 上传的原始文件ID
  
  // AI生成信息
  aiGenerated: boolean('ai_generated').notNull().default(false),
  aiGenerateMode: aiGenerateModeEnum('ai_generate_mode'),
  
  // 权限
  viewPermission: varchar('view_permission', { length: 20 }).default('all'),
  editPermission: varchar('edit_permission', { length: 20 }).default('self'),
  
  // 版本
  version: integer('version').notNull().default(1),
  
  // 有效期
  expiryDate: timestamp('expiry_date'),
  expiryReminded: boolean('expiry_reminded').notNull().default(false),
  
  // 归档信息
  archivedAt: timestamp('archived_at'),
  archivedBy: integer('archived_by').references(() => users.id),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 方案章节表
// ============================================

export const schemeChapters = pgTable('scheme_chapters', {
  id: serial('id').primaryKey(),
  schemeId: integer('scheme_id').notNull().references(() => schemes.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references((): any => schemeChapters.id, { onDelete: 'cascade' }),
  
  // 章节信息
  serialNumber: varchar('serial_number', { length: 20 }),
  title: varchar('title', { length: 300 }).notNull(),
  content: text('content'),
  
  // 统计
  wordCount: integer('word_count').notNull().default(0),
  
  // 层级
  level: integer('level').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
  
  // 状态
  isRequired: boolean('is_required').notNull().default(true),
  isCompleted: boolean('is_completed').notNull().default(false),
  
  // AI生成
  aiGenerated: boolean('ai_generated').notNull().default(false),
  aiGenerateMode: aiGenerateModeEnum('ai_generate_mode'),
  
  // 分配
  assignedTo: integer('assigned_to').references(() => users.id),
  deadline: timestamp('deadline'),
  completedAt: timestamp('completed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 方案标签关联表
// ============================================

export const schemeTagRelations = pgTable('scheme_tag_relations', {
  id: serial('id').primaryKey(),
  schemeId: integer('scheme_id').notNull().references(() => schemes.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => schemeTags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 方案附件表
// ============================================

export const schemeFiles = pgTable('scheme_files', {
  id: serial('id').primaryKey(),
  schemeId: integer('scheme_id').notNull().references(() => schemes.id, { onDelete: 'cascade' }),
  
  // 文件信息
  fileName: varchar('file_name', { length: 200 }).notNull(),
  originalName: varchar('original_name', { length: 200 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  
  // 存储
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  storageType: varchar('storage_type', { length: 20 }).default('local'),
  
  // 状态
  status: varchar('status', { length: 20 }).notNull().default('active'),
  
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
});

// ============================================
// 方案AI生成记录表
// ============================================

export const schemeGenerationLogs = pgTable('scheme_generation_logs', {
  id: serial('id').primaryKey(),
  schemeId: integer('scheme_id').references(() => schemes.id, { onDelete: 'cascade' }),
  chapterId: integer('chapter_id').references(() => schemeChapters.id, { onDelete: 'cascade' }),
  
  // 生成模式
  generateType: varchar('generate_type', { length: 20 }).notNull(), // full/segment
  generateMode: aiGenerateModeEnum('generate_mode').notNull(),
  
  // 输入参数
  inputPrompt: text('input_prompt'),
  parameters: text('parameters'), // JSON格式
  
  // 输出结果
  outputContent: text('output_content'),
  outputWordCount: integer('output_word_count'),
  
  // 性能指标
  duration: integer('duration'), // 毫秒
  tokenUsed: integer('token_used'),
  
  // 状态
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/processing/completed/failed
  errorMessage: text('error_message'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// ============================================
// 方案版本记录表
// ============================================

export const schemeVersions = pgTable('scheme_versions', {
  id: serial('id').primaryKey(),
  schemeId: integer('scheme_id').notNull().references(() => schemes.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  
  // 快照
  content: text('content'), // 完整内容快照
  wordCount: integer('word_count'),
  chapterCount: integer('chapter_count'),
  
  // 变更信息
  changeLog: text('change_log'),
  changeType: varchar('change_type', { length: 20 }), // create/edit/ai_generate/upload
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 方案分享表
// ============================================

export const schemeShares = pgTable('scheme_shares', {
  id: serial('id').primaryKey(),
  schemeId: integer('scheme_id').notNull().references(() => schemes.id, { onDelete: 'cascade' }),
  
  // 分享信息
  shareCode: varchar('share_code', { length: 32 }).notNull().unique(),
  permission: varchar('permission', { length: 20 }).notNull().default('view'), // view/edit
  
  // 有效期
  expiresAt: timestamp('expires_at'),
  
  // 访问统计
  accessCount: integer('access_count').notNull().default(0),
  lastAccessAt: timestamp('last_access_at'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 类型导出
// ============================================

export type SchemeCategory = typeof schemeCategories.$inferSelect;
export type NewSchemeCategory = typeof schemeCategories.$inferInsert;
export type SchemeTag = typeof schemeTags.$inferSelect;
export type NewSchemeTag = typeof schemeTags.$inferInsert;
export type Scheme = typeof schemes.$inferSelect;
export type NewScheme = typeof schemes.$inferInsert;
export type SchemeChapter = typeof schemeChapters.$inferSelect;
export type NewSchemeChapter = typeof schemeChapters.$inferInsert;
export type SchemeFile = typeof schemeFiles.$inferSelect;
export type NewSchemeFile = typeof schemeFiles.$inferInsert;
export type SchemeGenerationLog = typeof schemeGenerationLogs.$inferSelect;
export type SchemeVersion = typeof schemeVersions.$inferSelect;
export type SchemeShare = typeof schemeShares.$inferSelect;

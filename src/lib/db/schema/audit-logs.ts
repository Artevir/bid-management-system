/**
 * 审计日志 Schema
 * 记录所有系统关键操作
 */

import { pgTable, uuid, varchar, timestamp, text, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ============================================
// 操作类型枚举
// ============================================

export const AuditActionType = {
  // 认证相关
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  
  // 项目相关
  PROJECT_CREATE: 'project_create',
  PROJECT_UPDATE: 'project_update',
  PROJECT_DELETE: 'project_delete',
  PROJECT_VIEW: 'project_view',
  
  // 文档相关
  DOCUMENT_UPLOAD: 'document_upload',
  DOCUMENT_DOWNLOAD: 'document_download',
  DOCUMENT_UPDATE: 'document_update',
  DOCUMENT_DELETE: 'document_delete',
  DOCUMENT_VIEW: 'document_view',
  
  // 审核相关
  REVIEW_CREATE: 'review_create',
  REVIEW_APPROVE: 'review_approve',
  REVIEW_REJECT: 'review_reject',
  
  // 用户相关
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  
  // 权限相关
  ROLE_ASSIGN: 'role_assign',
  ROLE_REMOVE: 'role_remove',
  PERMISSION_GRANT: 'permission_grant',
  PERMISSION_REVOKE: 'permission_revoke',
  
  // 系统相关
  SYSTEM_CONFIG_UPDATE: 'system_config_update',
  DATA_EXPORT: 'data_export',
  DATA_IMPORT: 'data_import',
  
  // 其他
  OTHER: 'other',
} as const;

export type AuditAction = typeof AuditActionType[keyof typeof AuditActionType];

// ============================================
// 审计日志表
// ============================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 50 }).notNull(), // 操作类型
  resourceType: varchar('resource_type', { length: 50 }), // 资源类型：project, document, user, etc.
  resourceId: uuid('resource_id'), // 资源ID
  details: jsonb('details'), // 操作详情
  ip: varchar('ip', { length: 50 }), // IP地址
  userAgent: text('user_agent'), // 用户代理
  success: varchar('success', { length: 10 }).notNull().default('true'), // 操作是否成功：true/false
  errorMessage: text('error_message'), // 错误信息
  duration: varchar('duration', { length: 50 }), // 操作耗时（毫秒）
  metadata: jsonb('metadata'), // 额外元数据
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_audit_logs_user_id').on(table.userId),
  actionIdx: index('idx_audit_logs_action').on(table.action),
  resourceTypeIdx: index('idx_audit_logs_resource_type').on(table.resourceType),
  resourceIdIdx: index('idx_audit_logs_resource_id').on(table.resourceId),
  createdAtIdx: index('idx_audit_logs_created_at').on(table.createdAt),
  successIdx: index('idx_audit_logs_success').on(table.success),
  userActionIdx: index('idx_audit_logs_user_action').on(table.userId, table.action),
  actionTimeIdx: index('idx_audit_logs_action_time').on(table.action, table.createdAt),
}));

// ============================================
// 关系定义
// ============================================

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ============================================
// 审计日志接口
// ============================================

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  duration?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface AuditLogCreate {
  userId: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  userId?: string;
  action?: AuditAction | AuditAction[];
  resourceType?: string;
  resourceId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditLogStats {
  totalLogs: number;
  successLogs: number;
  failedLogs: number;
  actionCounts: Record<AuditAction, number>;
  userActivity: Array<{
    userId: string;
    userName?: string;
    actionCount: number;
  }>;
  resourceTypeCounts: Record<string, number>;
}

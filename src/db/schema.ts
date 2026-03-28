/**
 * 数据库Schema定义
 * 包含用户、角色、权限、部门等核心表
 */

import {
  pgTable,
  serial,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// 枚举定义
// ============================================

// 用户状态枚举
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'locked']);

// 文档密级枚举
export const documentSecurityLevelEnum = pgEnum('document_security_level', [
  'public',    // 公开
  'internal',  // 内部
  'confidential', // 机密
  'secret',    // 绝密
]);

// ============================================
// 部门表
// ============================================

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  parentId: integer('parent_id'),
  description: text('description'),
  level: integer('level').notNull().default(1), // 部门层级
  sortOrder: integer('sort_order').notNull().default(0), // 排序
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 用户表
// ============================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  realName: varchar('real_name', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  avatar: varchar('avatar', { length: 255 }),
  departmentId: integer('department_id').notNull().references(() => departments.id),
  position: varchar('position', { length: 50 }), // 职位
  status: userStatusEnum('status').notNull().default('active'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 50 }),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    usernameIdx: uniqueIndex('users_username_idx').on(table.username),
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  };
});

// ============================================
// 角色表
// ============================================

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  code: varchar('code', { length: 50 }).notNull().unique(), // 角色代码
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false), // 是否系统内置角色
  level: integer('level').notNull().default(1), // 角色级别
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    nameIdx: uniqueIndex('roles_name_idx').on(table.name),
    codeIdx: uniqueIndex('roles_code_idx').on(table.code),
  };
});

// ============================================
// 权限表
// ============================================

export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 100 }).notNull().unique(), // 权限代码
  resource: varchar('resource', { length: 50 }).notNull(), // 资源名称（如user, project, document）
  action: varchar('action', { length: 20 }).notNull(), // 操作（如create, read, update, delete）
  description: text('description'),
  parentId: integer('parent_id'),
  type: varchar('type', { length: 20 }).notNull().default('menu'), // 类型：menu/api
  path: varchar('path', { length: 255 }), // 菜单路径或API路径
  method: varchar('method', { length: 10 }), // HTTP方法（GET/POST/PUT/DELETE）
  icon: varchar('icon', { length: 50 }), // 菜单图标
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    codeIdx: uniqueIndex('permissions_code_idx').on(table.code),
    resourceActionIdx: uniqueIndex('permissions_resource_action_idx').on(table.resource, table.action),
  };
});

// ============================================
// 用户角色关联表（多对多）
// ============================================

export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedBy: integer('assigned_by').references(() => users.id), // 分配人
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // 过期时间（可选）
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    userRoleIdx: uniqueIndex('user_roles_user_role_idx').on(table.userId, table.roleId),
  };
});

// ============================================
// 角色权限关联表（多对多）
// ============================================

export const rolePermissions = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  grantedBy: integer('granted_by').references(() => users.id), // 授权人
  grantedAt: timestamp('granted_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    rolePermissionIdx: uniqueIndex('role_permissions_role_permission_idx').on(table.roleId, table.permissionId),
  };
});

// ============================================
// 项目状态枚举
// ============================================

export const projectStatusEnum = pgEnum('project_status', [
  'draft',       // 草稿
  'parsing',     // 文档解析中
  'preparing',   // 标书编制中
  'reviewing',   // 审核中
  'approved',    // 已通过
  'submitted',   // 已投标
  'awarded',     // 已中标
  'lost',        // 未中标
  'completed',   // 已完结（签订合同后）
  'archived',    // 已归档
]);

// 项目阶段类型枚举
export const projectPhaseTypeEnum = pgEnum('project_phase_type', [
  'preparation', // 准备阶段
  'analysis',    // 分析阶段
  'drafting',    // 编制阶段
  'review',      // 审核阶段
  'submission',  // 投标阶段
]);

// 文件分类枚举
export const fileCategoryEnum = pgEnum('file_category', [
  'tender_doc',      // 招标文件
  'response_doc',    // 响应文件
  'reference',       // 参考资料
  'knowledge',       // 知识文档
  'template',        // 模板文件
  'attachment',      // 附件
]);

// ============================================
// 项目表
// ============================================

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(), // 项目编号
  tenderCode: varchar('tender_code', { length: 100 }), // 招标编号
  type: varchar('type', { length: 50 }), // 项目类型
  industry: varchar('industry', { length: 50 }), // 行业
  region: varchar('region', { length: 50 }), // 区域
  status: projectStatusEnum('status').notNull().default('draft'), // 项目状态
  currentPhaseId: integer('current_phase_id'), // 当前阶段ID
  
  // 招标信息
  tenderOrganization: varchar('tender_organization', { length: 200 }), // 招标单位
  tenderAgent: varchar('tender_agent', { length: 200 }), // 招标代理
  tenderMethod: varchar('tender_method', { length: 50 }), // 招标方式
  budget: varchar('budget', { length: 100 }), // 预算金额
  
  // 政采单位关联
  platformId: integer('platform_id'), // 招标单位ID（关联政采单位）
  agentPlatformId: integer('agent_platform_id'), // 招标代理机构ID（关联政采单位）
  
  // 关键时间节点
  publishDate: timestamp('publish_date'), // 招标公告日期
  registerDeadline: timestamp('register_deadline'), // 报名截止日期
  questionDeadline: timestamp('question_deadline'), // 答疑截止日期
  submissionDeadline: timestamp('submission_deadline'), // 投标截止日期
  openBidDate: timestamp('open_bid_date'), // 开标日期
  
  // 项目管理
  ownerId: integer('owner_id').notNull().references(() => users.id), // 项目负责人
  departmentId: integer('department_id').notNull().references(() => departments.id), // 所属部门
  description: text('description'),
  
  // 统计信息
  totalScore: integer('total_score'), // 总评分项数
  completedScore: integer('completed_score'), // 已完成评分项数
  progress: integer('progress').notNull().default(0), // 进度百分比
  
  // 标签
  tags: text('tags'), // JSON数组存储标签
  
  // 软删除
  isDeleted: boolean('is_deleted').notNull().default(false), // 是否已删除
  deletedAt: timestamp('deleted_at'), // 删除时间
  deletedBy: integer('deleted_by').references(() => users.id), // 删除人
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 项目阶段表
// ============================================

export const projectPhases = pgTable('project_phases', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: projectPhaseTypeEnum('type').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/in_progress/completed
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  completedAt: timestamp('completed_at'),
  completedBy: integer('completed_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 项目节点表（关键里程碑）
// ============================================

export const projectMilestones = pgTable('project_milestones', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phaseId: integer('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  dueDate: timestamp('due_date').notNull(),
  completedAt: timestamp('completed_at'),
  completedBy: integer('completed_by').references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/completed/overdue
  reminderSent: boolean('reminder_sent').notNull().default(false),
  reminderDays: integer('reminder_days').notNull().default(3), // 提前多少天提醒
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 文件分类表
// ============================================

export const fileCategories = pgTable('file_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  category: fileCategoryEnum('category').notNull(),
  description: text('description'),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 文件表
// ============================================

export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(), // 原始文件名
  path: varchar('path', { length: 500 }).notNull(), // 存储路径
  size: integer('size').notNull(), // 文件大小（字节）
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  extension: varchar('extension', { length: 20 }), // 文件扩展名
  hash: varchar('hash', { length: 64 }), // 文件哈希（用于去重）
  
  // 分类与安全
  categoryId: integer('category_id').references(() => fileCategories.id),
  securityLevel: documentSecurityLevelEnum('security_level').notNull().default('internal'),
  
  // 版本控制
  currentVersion: integer('current_version').notNull().default(1),
  
  // 上传信息
  uploaderId: integer('uploader_id').notNull().references(() => users.id),
  
  // 状态
  status: varchar('status', { length: 20 }).notNull().default('active'), // active/archived/deleted
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 文件版本表
// ============================================

export const fileVersions = pgTable('file_versions', {
  id: serial('id').primaryKey(),
  fileId: integer('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  path: varchar('path', { length: 500 }).notNull(), // 该版本的存储路径
  size: integer('size').notNull(),
  hash: varchar('hash', { length: 64 }),
  changeLog: text('change_log'), // 变更说明
  uploaderId: integer('uploader_id').notNull().references(() => users.id),
  // 版本锁定功能
  isLocked: boolean('is_locked').notNull().default(false), // 是否锁定
  lockedBy: integer('locked_by').references(() => users.id), // 锁定人
  lockedAt: timestamp('locked_at'), // 锁定时间
  lockReason: text('lock_reason'), // 锁定原因
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    fileVersionIdx: uniqueIndex('file_versions_file_version_idx').on(table.fileId, table.version),
  };
});

// ============================================
// 项目文件关联表
// ============================================

export const projectFiles = pgTable('project_files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fileId: integer('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // tender_doc/response_doc/reference等
  description: text('description'),
  addedBy: integer('added_by').notNull().references(() => users.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => {
  return {
    projectFileIdx: uniqueIndex('project_files_project_file_idx').on(table.projectId, table.fileId),
  };
});

// ============================================
// 项目成员表
// ============================================

export const projectMembers = pgTable('project_members', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(), // 成员角色：owner/editor/viewer/auditor
  canView: boolean('can_view').notNull().default(true),
  canEdit: boolean('can_edit').notNull().default(false),
  canAudit: boolean('can_audit').notNull().default(false),
  canExport: boolean('can_export').notNull().default(false),
  maxSecurityLevel: documentSecurityLevelEnum('max_security_level').default('internal'), // 最高可访问密级
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  invitedBy: integer('invited_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    projectUserIdx: uniqueIndex('project_members_project_user_idx').on(table.projectId, table.userId),
  };
});

// ============================================
// 项目标签表
// ============================================

export const projectTags = pgTable('project_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 20 }).notNull().default('#6366f1'), // 标签颜色
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    nameIdx: uniqueIndex('project_tags_name_idx').on(table.name),
  };
});

// ============================================
// 项目标签关联表
// ============================================

export const projectTagRelations = pgTable('project_tag_relations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => projectTags.id, { onDelete: 'cascade' }),
  addedBy: integer('added_by').references(() => users.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => {
  return {
    projectTagIdx: uniqueIndex('project_tag_relations_project_tag_idx').on(table.projectId, table.tagId),
  };
});

// ============================================
// 操作审计日志表
// ============================================

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  username: varchar('username', { length: 50 }), // 冗余存储，防止用户删除后无法追溯
  action: varchar('action', { length: 50 }).notNull(), // 操作类型：login/logout/create/update/delete/export等
  resource: varchar('resource', { length: 50 }).notNull(), // 资源类型
  resourceId: integer('resource_id'), // 资源ID
  resourceCode: varchar('resource_code', { length: 100 }), // 资源编号
  description: text('description'), // 操作描述
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  requestMethod: varchar('request_method', { length: 10 }),
  requestPath: varchar('request_path', { length: 255 }),
  requestParams: text('request_params'), // JSON格式存储
  projectId: integer('project_id'), // 关联项目ID (P2 优化：增强审计可追溯性)
  responseStatus: integer('response_status'),
  errorMessage: text('error_message'),
  duration: integer('duration'), // 执行时长（毫秒）
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 会话表（用于JWT刷新令牌管理）
// ============================================

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(), // 刷新令牌哈希
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  deviceInfo: varchar('device_info', { length: 255 }), // 设备信息
  expiresAt: timestamp('expires_at').notNull(),
  lastAccessedAt: timestamp('last_accessed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    tokenHashIdx: uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
    userIdIdx: uniqueIndex('sessions_user_id_idx').on(table.userId),
  };
});

// ============================================
// 通知表
// ============================================

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 通知类型：project_reminder/review_request/system等
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  priority: varchar('priority', { length: 20 }).notNull().default('normal'), // low/normal/high/urgent
  link: varchar('link', { length: 500 }), // 跳转链接
  metadata: text('metadata'), // JSON格式存储额外数据
  senderId: integer('sender_id').references(() => users.id), // 发送者ID
  relatedType: varchar('related_type', { length: 50 }), // 关联资源类型
  relatedId: integer('related_id'), // 关联资源ID
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: uniqueIndex('notifications_user_id_idx').on(table.userId),
    isReadIdx: uniqueIndex('notifications_is_read_idx').on(table.isRead),
  };
});

// ============================================
// 审校配置表
// ============================================

export const reviewConfigs = pgTable('review_configs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  projectTypeId: integer('project_type_id'), // 关联项目类型
  checkItems: text('check_items'), // JSON数组存储检查项配置
  reviewers: text('reviewers'), // JSON数组存储审校人ID列表
  minReviewers: integer('min_reviewers').notNull().default(1), // 最少审校人数
  requireAllApprove: boolean('require_all_approve').notNull().default(false), // 是否需要所有人同意
  autoAssign: boolean('auto_assign').notNull().default(true), // 是否自动分配
  maxDuration: integer('max_duration').notNull().default(72), // 最长审校时间（小时）
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 审校规则表
// ============================================

export const reviewRules = pgTable('review_rules', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // format/content/compliance/custom
  description: text('description'),
  condition: text('condition').notNull(), // JSON格式存储规则条件
  severity: varchar('severity', { length: 20 }).notNull().default('warning'), // error/warning/info
  autoFix: boolean('auto_fix').notNull().default(false), // 是否支持自动修复
  fixSuggestion: text('fix_suggestion'), // 修复建议
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 审校模板表
// ============================================

export const reviewTemplates = pgTable('review_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  configId: integer('config_id').references(() => reviewConfigs.id),
  ruleIds: text('rule_ids'), // JSON数组存储规则ID列表
  isDefault: boolean('is_default').notNull().default(false), // 是否为默认模板
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 关系定义
// ============================================

// 用户关系
export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  userRoles: many(userRoles),
  sessions: many(sessions),
  projectMemberships: many(projectMembers),
  createdProjects: many(projects, { relationName: 'project_owner' }),
}));

// 部门关系
export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parent: one(departments, {
    fields: [departments.parentId],
    references: [departments.id],
    relationName: 'department_hierarchy',
  }),
  children: many(departments, { relationName: 'department_hierarchy' }),
  users: many(users),
  projects: many(projects),
}));

// 角色关系
export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

// 权限关系
export const permissionsRelations = relations(permissions, ({ one, many }) => ({
  parent: one(permissions, {
    fields: [permissions.parentId],
    references: [permissions.id],
    relationName: 'permission_hierarchy',
  }),
  children: many(permissions, { relationName: 'permission_hierarchy' }),
  rolePermissions: many(rolePermissions),
}));

// 用户角色关系
export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
    relationName: 'user_role_assigner',
  }),
}));

// 角色权限关系
export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
  grantedByUser: one(users, {
    fields: [rolePermissions.grantedBy],
    references: [users.id],
    relationName: 'role_permission_granter',
  }),
}));

// 项目关系
export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
    relationName: 'project_owner',
  }),
  department: one(departments, {
    fields: [projects.departmentId],
    references: [departments.id],
  }),
  currentPhase: one(projectPhases, {
    fields: [projects.currentPhaseId],
    references: [projectPhases.id],
  }),
  members: many(projectMembers),
  phases: many(projectPhases),
  milestones: many(projectMilestones),
  projectFiles: many(projectFiles),
  tagRelations: many(projectTagRelations),
}));

// 项目阶段关系
export const projectPhasesRelations = relations(projectPhases, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectPhases.projectId],
    references: [projects.id],
  }),
  completedByUser: one(users, {
    fields: [projectPhases.completedBy],
    references: [users.id],
  }),
  milestones: many(projectMilestones),
}));

// 项目节点关系
export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
  project: one(projects, {
    fields: [projectMilestones.projectId],
    references: [projects.id],
  }),
  phase: one(projectPhases, {
    fields: [projectMilestones.phaseId],
    references: [projectPhases.id],
  }),
  completedByUser: one(users, {
    fields: [projectMilestones.completedBy],
    references: [users.id],
  }),
}));

// 文件分类关系
export const fileCategoriesRelations = relations(fileCategories, ({ one, many }) => ({
  parent: one(fileCategories, {
    fields: [fileCategories.parentId],
    references: [fileCategories.id],
    relationName: 'file_category_hierarchy',
  }),
  children: many(fileCategories, { relationName: 'file_category_hierarchy' }),
  files: many(files),
}));

// 文件关系
export const filesRelations = relations(files, ({ one, many }) => ({
  category: one(fileCategories, {
    fields: [files.categoryId],
    references: [fileCategories.id],
  }),
  uploader: one(users, {
    fields: [files.uploaderId],
    references: [users.id],
    relationName: 'file_uploader',
  }),
  versions: many(fileVersions),
  projectFiles: many(projectFiles),
}));

// 文件版本关系
export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(files, {
    fields: [fileVersions.fileId],
    references: [files.id],
  }),
  uploader: one(users, {
    fields: [fileVersions.uploaderId],
    references: [users.id],
    relationName: 'file_version_uploader',
  }),
}));

// 项目文件关系
export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
  file: one(files, {
    fields: [projectFiles.fileId],
    references: [files.id],
  }),
  addedByUser: one(users, {
    fields: [projectFiles.addedBy],
    references: [users.id],
    relationName: 'project_file_adder',
  }),
}));

// 项目成员关系
export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  invitedByUser: one(users, {
    fields: [projectMembers.invitedBy],
    references: [users.id],
    relationName: 'project_member_inviter',
  }),
}));

// 审计日志关系
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// 会话关系
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ============================================
// 阶段2：文档智能与知识中台
// ============================================

// 解析任务状态枚举
export const parseTaskStatusEnum = pgEnum('parse_task_status', [
  'pending',     // 待处理
  'processing',  // 处理中
  'completed',   // 已完成
  'failed',      // 失败
]);

// 解析项类型枚举
export const parseItemTypeEnum = pgEnum('parse_item_type', [
  'deadline',        // 时间节点
  'qualification',   // 资格条件
  'scoring_item',    // 评分项
  'technical_param', // 技术参数
  'commercial',      // 商务条款
  'requirement',     // 其他要求
]);

// 知识状态枚举
export const knowledgeStatusEnum = pgEnum('knowledge_status', [
  'draft',       // 草稿
  'pending',     // 待审核
  'approved',    // 已通过
  'rejected',    // 已拒绝
  'deprecated',  // 已失效
]);

// ============================================
// 解析任务表
// ============================================

export const parseTasks = pgTable('parse_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fileId: integer('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 解析类型：full/section/custom
  status: parseTaskStatusEnum('status').notNull().default('pending'),
  progress: integer('progress').notNull().default(0), // 进度百分比
  totalPages: integer('total_pages'),
  processedPages: integer('processed_pages').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 解析结果表（按章节/页面）
// ============================================

export const parseResults = pgTable('parse_results', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => parseTasks.id, { onDelete: 'cascade' }),
  sectionTitle: varchar('section_title', { length: 255 }),
  sectionType: varchar('section_type', { length: 50 }), // 章节/表格/图片
  pageNumber: integer('page_number'),
  content: text('content'), // 原始文本内容
  summary: text('summary'), // AI生成的摘要
  confidence: integer('confidence'), // 置信度 0-100
  rawResult: text('raw_result'), // JSON格式存储原始解析结果
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    taskSectionIdx: uniqueIndex('parse_results_task_section_idx').on(table.taskId, table.pageNumber, table.sectionTitle),
  };
});

// ============================================
// 解析项表（抽取的结构化信息）
// ============================================

export const parseItems = pgTable('parse_items', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => parseTasks.id, { onDelete: 'cascade' }),
  resultId: integer('result_id').references(() => parseResults.id, { onDelete: 'set null' }),
  type: parseItemTypeEnum('type').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  originalText: text('original_text'), // 原文引用
  pageNumber: integer('page_number'),
  position: text('position'), // JSON格式存储位置信息
  confidence: integer('confidence').notNull().default(100), // 置信度
  isLowConfidence: boolean('is_low_confidence').notNull().default(false), // 低置信度标记
  isConfirmed: boolean('is_confirmed').notNull().default(false), // 人工确认
  confirmedBy: integer('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at'),
  extraData: text('extra_data'), // JSON格式存储额外数据
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 响应矩阵主表
// ============================================

export const responseMatrices = pgTable('response_matrices', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft/active/completed
  totalItems: integer('total_items').notNull().default(0),
  completedItems: integer('completed_items').notNull().default(0),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    projectMatrixIdx: uniqueIndex('response_matrices_project_name_idx').on(table.projectId, table.name),
  };
});

// ============================================
// 响应条目表
// ============================================

export const responseItems = pgTable('response_items', {
  id: serial('id').primaryKey(),
  matrixId: integer('matrix_id').notNull().references(() => responseMatrices.id, { onDelete: 'cascade' }),
  parseItemId: integer('parse_item_id').references(() => parseItems.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 30 }).notNull(), // qualification/scoring_item/requirement
  serialNumber: varchar('serial_number', { length: 50 }), // 序号
  title: varchar('title', { length: 500 }).notNull(),
  requirement: text('requirement'), // 要求描述
  requirementType: varchar('requirement_type', { length: 30 }), // 必须响应/可选响应
  score: integer('score'), // 分值（评分项）
  response: text('response'), // 响应内容
  responseStatus: varchar('response_status', { length: 20 }).default('pending'), // pending/responded/reviewed
  assigneeId: integer('assignee_id').references(() => users.id), // 分配人
  chapterId: integer('chapter_id'), // 关联的标书章节ID
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 知识分类表
// ============================================

export const knowledgeCategories = pgTable('knowledge_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  parentId: integer('parent_id'),
  description: text('description'),
  icon: varchar('icon', { length: 50 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 知识标签表
// ============================================

export const knowledgeTags = pgTable('knowledge_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  color: varchar('color', { length: 20 }),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    nameIdx: uniqueIndex('knowledge_tags_name_idx').on(table.name),
  };
});

// ============================================
// 知识条目表
// ============================================

export const knowledgeItems = pgTable('knowledge_items', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => knowledgeCategories.id),
  title: varchar('title', { length: 300 }).notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  keywords: text('keywords'), // JSON数组存储关键词
  source: varchar('source', { length: 100 }), // 来源
  sourceUrl: varchar('source_url', { length: 500 }), // 来源URL
  status: knowledgeStatusEnum('status').notNull().default('draft'),
  currentVersion: integer('current_version').notNull().default(1),
  viewCount: integer('view_count').notNull().default(0),
  useCount: integer('use_count').notNull().default(0),
  embeddingVector: text('embedding_vector'), // 向量嵌入（JSON格式）
  authorId: integer('author_id').notNull().references(() => users.id),
  reviewerId: integer('reviewer_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  effectiveFrom: timestamp('effective_from'), // 生效日期
  effectiveTo: timestamp('effective_to'), // 失效日期
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 知识审批配置表
// ============================================

export const knowledgeApprovalConfigs = pgTable('knowledge_approval_configs', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => knowledgeCategories.id, { onDelete: 'cascade' }),
  reviewers: text('reviewers').notNull(), // JSON数组存储审批人ID列表
  requireAllApprove: boolean('require_all_approve').notNull().default(false), // 是否需要所有人审批
  minApprovals: integer('min_approvals').notNull().default(1), // 最少审批人数
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 知识审批申请表
// ============================================

export const knowledgeApprovalRequests = pgTable('knowledge_approval_requests', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => knowledgeItems.id, { onDelete: 'cascade' }),
  requesterId: integer('requester_id').notNull().references(() => users.id),
  reason: text('reason'), // 申请说明
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/approved/rejected/returned
  currentStep: integer('current_step').notNull().default(1), // 当前审批步骤
  totalSteps: integer('total_steps').notNull().default(1), // 总审批步骤
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 知识审批步骤表
// ============================================

export const knowledgeApprovalSteps = pgTable('knowledge_approval_steps', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').notNull().references(() => knowledgeApprovalRequests.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull(), // 步骤顺序
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('waiting'), // waiting/pending/approved/rejected/returned
  action: varchar('action', { length: 20 }), // approve/reject/return
  comment: text('comment'), // 审批意见
  createdAt: timestamp('created_at').notNull().defaultNow(),
  actedAt: timestamp('acted_at'), // 审批时间
}, (table) => {
  return {
    requestStepIdx: uniqueIndex('knowledge_approval_steps_request_step_idx').on(table.requestId, table.stepOrder),
  };
});

// ============================================
// 知识条目标签关联表
// ============================================

export const knowledgeItemTags = pgTable('knowledge_item_tags', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => knowledgeItems.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => knowledgeTags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    itemTagIdx: uniqueIndex('knowledge_item_tags_item_tag_idx').on(table.itemId, table.tagId),
  };
});

// ============================================
// 知识版本表
// ============================================

export const knowledgeVersions = pgTable('knowledge_versions', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').notNull().references(() => knowledgeItems.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  changeLog: text('change_log'), // 变更说明
  authorId: integer('author_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    itemVersionIdx: uniqueIndex('knowledge_versions_item_version_idx').on(table.itemId, table.version),
  };
});

// ============================================
// 解析任务关系
// ============================================

export const parseTasksRelations = relations(parseTasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [parseTasks.projectId],
    references: [projects.id],
  }),
  file: one(files, {
    fields: [parseTasks.fileId],
    references: [files.id],
  }),
  creator: one(users, {
    fields: [parseTasks.createdBy],
    references: [users.id],
  }),
  results: many(parseResults),
  items: many(parseItems),
}));

// 解析结果关系
export const parseResultsRelations = relations(parseResults, ({ one, many }) => ({
  task: one(parseTasks, {
    fields: [parseResults.taskId],
    references: [parseTasks.id],
  }),
  items: many(parseItems),
}));

// 解析项关系
export const parseItemsRelations = relations(parseItems, ({ one }) => ({
  task: one(parseTasks, {
    fields: [parseItems.taskId],
    references: [parseTasks.id],
  }),
  result: one(parseResults, {
    fields: [parseItems.resultId],
    references: [parseResults.id],
  }),
  confirmer: one(users, {
    fields: [parseItems.confirmedBy],
    references: [users.id],
  }),
}));

// 响应矩阵关系
export const responseMatricesRelations = relations(responseMatrices, ({ one, many }) => ({
  project: one(projects, {
    fields: [responseMatrices.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [responseMatrices.createdBy],
    references: [users.id],
  }),
  items: many(responseItems),
}));

// 响应条目关系
export const responseItemsRelations = relations(responseItems, ({ one }) => ({
  matrix: one(responseMatrices, {
    fields: [responseItems.matrixId],
    references: [responseMatrices.id],
  }),
  parseItem: one(parseItems, {
    fields: [responseItems.parseItemId],
    references: [parseItems.id],
  }),
  assignee: one(users, {
    fields: [responseItems.assigneeId],
    references: [users.id],
  }),
}));

// 知识分类关系
export const knowledgeCategoriesRelations = relations(knowledgeCategories, ({ one, many }) => ({
  parent: one(knowledgeCategories, {
    fields: [knowledgeCategories.parentId],
    references: [knowledgeCategories.id],
    relationName: 'knowledge_category_hierarchy',
  }),
  children: many(knowledgeCategories, { relationName: 'knowledge_category_hierarchy' }),
  items: many(knowledgeItems),
}));

// 知识标签关系
export const knowledgeTagsRelations = relations(knowledgeTags, ({ many }) => ({
  itemTags: many(knowledgeItemTags),
}));

// 知识条目关系
export const knowledgeItemsRelations = relations(knowledgeItems, ({ one, many }) => ({
  category: one(knowledgeCategories, {
    fields: [knowledgeItems.categoryId],
    references: [knowledgeCategories.id],
  }),
  author: one(users, {
    fields: [knowledgeItems.authorId],
    references: [users.id],
    relationName: 'knowledge_author',
  }),
  reviewer: one(users, {
    fields: [knowledgeItems.reviewerId],
    references: [users.id],
    relationName: 'knowledge_reviewer',
  }),
  tags: many(knowledgeItemTags),
  versions: many(knowledgeVersions),
}));

// 知识条目标签关系
export const knowledgeItemTagsRelations = relations(knowledgeItemTags, ({ one }) => ({
  item: one(knowledgeItems, {
    fields: [knowledgeItemTags.itemId],
    references: [knowledgeItems.id],
  }),
  tag: one(knowledgeTags, {
    fields: [knowledgeItemTags.tagId],
    references: [knowledgeTags.id],
  }),
}));

// 知识版本关系
export const knowledgeVersionsRelations = relations(knowledgeVersions, ({ one }) => ({
  item: one(knowledgeItems, {
    fields: [knowledgeVersions.itemId],
    references: [knowledgeItems.id],
  }),
  author: one(users, {
    fields: [knowledgeVersions.authorId],
    references: [users.id],
  }),
}));

// ============================================
// 阶段3：智能编标与审核流程
// ============================================

// 标书文档状态枚举
export const bidDocStatusEnum = pgEnum('bid_doc_status', [
  'draft',      // 草稿
  'editing',    // 编辑中
  'reviewing',  // 审核中
  'approved',   // 已通过
  'rejected',   // 已拒绝
  'published',  // 已发布
]);

// 章节类型枚举
export const chapterTypeEnum = pgEnum('chapter_type', [
  'cover',        // 封面
  'toc',          // 目录
  'business',     // 商务部分
  'technical',    // 技术部分
  'qualification', // 资质部分
  'price',        // 报价部分
  'appendix',     // 附录
]);

// 审核状态枚举
export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',     // 待审核
  'approved',    // 已通过
  'rejected',    // 已拒绝
  'returned',    // 已退回
]);

// 审核级别枚举
export const approvalLevelEnum = pgEnum('approval_level', [
  'first',   // 一级审核（编制人自查）
  'second',  // 二级审核（项目经理审核）
  'third',   // 三级审核（部门负责人审核）
  'final',   // 终审（公司领导审批）
]);

// 审校类型枚举
export const reviewTypeEnum = pgEnum('review_type', [
  'compliance',  // 合规检查
  'format',      // 格式检查
  'content',     // 内容检查
  'completeness', // 完整性检查
]);

// ============================================
// 标书文档表
// ============================================

export const bidDocuments = pgTable('bid_documents', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  version: integer('version').notNull().default(1),
  status: bidDocStatusEnum('status').notNull().default('draft'),
  totalChapters: integer('total_chapters').notNull().default(0),
  completedChapters: integer('completed_chapters').notNull().default(0),
  wordCount: integer('word_count').notNull().default(0),
  progress: integer('progress').notNull().default(0),
  
  // 统计缓存字段 (P1 性能优化)
  totalGenerations: integer('total_generations').notNull().default(0),
  completedGenerations: integer('completed_generations').notNull().default(0),
  totalReviews: integer('total_reviews').notNull().default(0),
  completedReviews: integer('completed_reviews').notNull().default(0),
  totalComplianceChecks: integer('total_compliance_checks').notNull().default(0),
  passedComplianceChecks: integer('passed_compliance_checks').notNull().default(0),
  failedComplianceChecks: integer('failed_compliance_checks').notNull().default(0),

  currentApprovalLevel: approvalLevelEnum('current_approval_level'),
  deadline: timestamp('deadline'),
  publishedAt: timestamp('published_at'),
  publishedBy: integer('published_by').references(() => users.id),
  createdBy: integer('created_by').notNull().references(() => users.id),
  // 软删除
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  deletedBy: integer('deleted_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 标书章节表
// ============================================

export const bidChapters = pgTable('bid_chapters', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => bidDocuments.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id'),
  type: chapterTypeEnum('type'),
  serialNumber: varchar('serial_number', { length: 20 }), // 章节编号
  title: varchar('title', { length: 300 }).notNull(),
  content: text('content'),
  version: integer('version').notNull().default(1),
  wordCount: integer('word_count').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  level: integer('level').notNull().default(1), // 章节层级
  isRequired: boolean('is_required').notNull().default(true), // 是否必填
  isCompleted: boolean('is_completed').notNull().default(false),
  assignedTo: integer('assigned_to').references(() => users.id), // 分配给谁编写
  deadline: timestamp('deadline'),
  completedAt: timestamp('completed_at'),
  responseItemId: integer('response_item_id').references(() => responseItems.id), // 关联响应矩阵项
  
  // AI生成相关
  promptTemplateId: integer('prompt_template_id').references(() => promptTemplates.id, { onDelete: 'set null' }), // 关联提示词模板
  promptParameters: text('prompt_parameters'), // JSON格式存储生成时使用的参数
  
  // 公司归属
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }), // 关联公司
  
  // 标签
  tags: text('tags'), // JSON数组存储标签ID列表
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    documentParentIdx: uniqueIndex('bid_chapters_document_parent_idx').on(table.documentId, table.parentId, table.sortOrder),
  };
});

// ============================================
// 审核流程表
// ============================================

export const approvalFlows = pgTable('approval_flows', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => bidDocuments.id, { onDelete: 'cascade' }),
  level: approvalLevelEnum('level').notNull(),
  status: approvalStatusEnum('status').notNull().default('pending'),
  assigneeId: integer('assignee_id').notNull().references(() => users.id),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  comment: text('comment'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    documentLevelIdx: uniqueIndex('approval_flows_document_level_idx').on(table.documentId, table.level),
  };
});

// ============================================
// 审核记录表（详细审核意见）
// ============================================

export const approvalRecords = pgTable('approval_records', {
  id: serial('id').primaryKey(),
  flowId: integer('flow_id').notNull().references(() => approvalFlows.id, { onDelete: 'cascade' }),
  chapterId: integer('chapter_id').references(() => bidChapters.id, { onDelete: 'set null' }),
  status: approvalStatusEnum('status').notNull(),
  comment: text('comment'), // 审核意见
  issues: text('issues'), // JSON数组存储问题列表
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  reviewedAt: timestamp('reviewed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 文档审校表
// ============================================

export const documentReviews = pgTable('document_reviews', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => bidDocuments.id, { onDelete: 'cascade' }),
  type: reviewTypeEnum('type').notNull(),
  score: integer('score'), // 评分 0-100
  result: text('result'), // JSON格式存储检查结果
  issues: text('issues'), // JSON数组存储问题列表
  suggestion: text('suggestion'), // AI建议
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/completed
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// AI生成文档审核表
// ============================================

export const bidDocumentReviews = pgTable('bid_document_reviews', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => bidDocuments.id, { onDelete: 'cascade' }),
  reviewType: varchar('review_type', { length: 50 }).notNull().default('ai_generation'), // 审核类型：ai_generation, content_review等
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, approved, rejected
  
  // 提交信息
  submittedBy: integer('submitted_by').notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  
  // 审核信息
  reviewerId: integer('reviewer_id').references(() => users.id),
  reviewerName: varchar('reviewer_name', { length: 100 }),
  reviewComments: text('review_comments'),
  reviewedAt: timestamp('reviewed_at'),
  
  // 审核结果详情
  reviewDetails: text('review_details'), // JSON格式存储审核详情
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 文档生成历史表
export const documentGenerationHistories = pgTable('document_generation_histories', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => bidDocuments.id, { onDelete: 'cascade' }),
  
  // 生成配置
  generationConfig: text('generation_config'), // JSON格式存储生成配置
  
  // 使用的数据源
  companyIds: text('company_ids'), // JSON数组
  interpretationId: integer('interpretation_id').references(() => bidDocumentInterpretations.id),
  partnerApplicationIds: text('partner_application_ids'), // JSON数组
  
  // 使用的模板
  templateIds: text('template_ids'), // JSON数组
  
  // 生成结果
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/generating/completed/failed
  totalChapters: integer('total_chapters').notNull().default(0),
  generatedChapters: integer('generated_chapters').notNull().default(0),
  totalWordCount: integer('total_word_count').notNull().default(0),
  
  // 时间记录
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // 毫秒
  
  // 错误信息
  errorMessage: text('error_message'),
  
  // 版本信息
  version: integer('version').notNull().default(1),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 合规检查表
// ============================================

export const complianceChecks = pgTable('compliance_checks', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => bidDocuments.id, { onDelete: 'cascade' }),
  chapterId: integer('chapter_id').references(() => bidChapters.id, { onDelete: 'set null' }),
  ruleId: varchar('rule_id', { length: 50 }), // 合规规则ID
  ruleName: varchar('rule_name', { length: 200 }).notNull(), // 规则名称
  description: text('description'), // 规则描述
  result: varchar('result', { length: 20 }).notNull(), // pass/fail/warning
  severity: varchar('severity', { length: 20 }), // critical/major/minor
  location: text('location'), // JSON格式存储位置信息
  suggestion: text('suggestion'), // 修改建议
  isResolved: boolean('is_resolved').notNull().default(false),
  resolvedBy: integer('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 审校报告表
// ============================================

export const reviewReports = pgTable('review_reports', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id').notNull().references(() => bidDocuments.id, { onDelete: 'cascade' }),
  reportNo: varchar('report_no', { length: 50 }).notNull().unique(), // 报告编号
  title: varchar('title', { length: 200 }).notNull(), // 报告标题
  type: varchar('type', { length: 50 }).notNull(), // compliance/format/content/complete/full
  score: integer('score'), // 综合评分 0-100
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft/published/archived
  
  // 报告内容
  summary: text('summary'), // 报告摘要
  issues: text('issues'), // JSON格式存储问题列表
  statistics: text('statistics'), // JSON格式存储统计数据
  recommendations: text('recommendations'), // JSON格式存储改进建议
  
  // 导出信息
  exportedAt: timestamp('exported_at'), // 最后导出时间
  exportedBy: integer('exported_by').references(() => users.id),
  exportedFormat: varchar('exported_format', { length: 20 }), // pdf/docx/html
  
  // 审校范围
  reviewScope: text('review_scope'), // JSON格式存储审校范围配置
  reviewStartTime: timestamp('review_start_time'),
  reviewEndTime: timestamp('review_end_time'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 审校报告模板表
// ============================================

export const reviewReportTemplates = pgTable('review_report_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: text('description'),
  content: text('content'), // JSON格式存储模板内容结构
  isSystem: boolean('is_system').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 编标模板表
// ============================================

export const bidTemplates = pgTable('bid_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  category: varchar('category', { length: 50 }), // 模板分类
  industry: varchar('industry', { length: 50 }), // 行业
  description: text('description'),
  content: text('content'), // JSON格式存储模板结构
  isSystem: boolean('is_system').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  useCount: integer('use_count').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 方案功能：提示词模板管理
// ============================================

// 提示词分类枚举
export const promptCategoryEnum = pgEnum('prompt_category_type', [
  'technical',   // 技术方案
  'business',    // 商务标书
  'qualification', // 资质证明
  'proposal',    // 投标建议书
  'summary',     // 摘要生成
  'review',      // 审校检查
  'custom',      // 自定义
]);

// 提示词模板状态枚举
export const promptStatusEnum = pgEnum('prompt_status', [
  'draft',       // 草稿
  'active',      // 启用
  'archived',    // 已归档
]);

// AI角色类型枚举
export const agentRoleEnum = pgEnum('agent_role', [
  'sales_director',      // 销售总监
  'presales_director',   // 售前总监
  'finance_director',    // 财务总监
  'customer',            // 客户
  'auditor',             // 审核员
  'technical_expert',    // 技术专家
  'legal_advisor',       // 法务顾问
  'project_manager',     // 项目经理
  'bid_specialist',      // 投标专员
  'custom',              // 自定义
]);

// 提示词分类表
export const promptCategories = pgTable('prompt_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: promptCategoryEnum('type').notNull().default('custom'),
  description: text('description'),
  icon: varchar('icon', { length: 50 }),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 提示词模板表
export const promptTemplates = pgTable('prompt_templates', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => promptCategories.id),
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 100 }).notNull().unique(), // 唯一标识
  description: text('description'),
  
  // AI角色配置
  isAgent: boolean('is_agent').notNull().default(false), // 是否为AI角色
  agentRole: agentRoleEnum('agent_role'), // 角色类型
  agentAvatar: varchar('agent_avatar', { length: 255 }), // 角色头像URL
  agentGreeting: text('agent_greeting'), // 欢迎语
  agentDescription: text('agent_description'), // 角色描述
  agentSkills: text('agent_skills'), // JSON数组存储技能列表
  
  // 模板内容
  content: text('content').notNull(), // 提示词内容（支持参数占位符 {{param}}）
  systemPrompt: text('system_prompt'), // 系统提示词
  
  // 模型配置
  modelProvider: varchar('model_provider', { length: 50 }), // coze/deepseek/qwen/openai等
  modelName: varchar('model_name', { length: 100 }), // 模型名称
  
  // 生成配置
  temperature: varchar('temperature', { length: 10 }), // 温度参数
  maxTokens: integer('max_tokens'), // 最大生成token数
  outputFormat: varchar('output_format', { length: 50 }).default('markdown'), // 输出格式：markdown/html/plain
  
  // 版本控制
  currentVersion: integer('current_version').notNull().default(1),
  
  // 状态
  status: promptStatusEnum('status').notNull().default('draft'),
  isSystem: boolean('is_system').notNull().default(false), // 系统内置
  isActive: boolean('is_active').notNull().default(true),
  
  // 统计
  useCount: integer('use_count').notNull().default(0),
  
  // 创建者
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 提示词参数表
export const promptParameters = pgTable('prompt_parameters', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id').notNull().references(() => promptTemplates.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 50 }).notNull(), // 参数名（占位符名称）
  label: varchar('label', { length: 100 }).notNull(), // 参数标签（显示名称）
  description: text('description'),
  
  type: varchar('type', { length: 20 }).notNull().default('text'), // text/number/select/date/user/project
  defaultValue: text('default_value'), // 默认值
  options: text('options'), // 选项（JSON数组，用于select类型）
  
  // 数据绑定
  bindingType: varchar('binding_type', { length: 30 }), // auto/user_input/project_field
  bindingField: varchar('binding_field', { length: 100 }), // 自动绑定的字段路径
  
  isRequired: boolean('is_required').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    templateParamIdx: uniqueIndex('prompt_parameters_template_param_idx').on(table.templateId, table.name),
  };
});

// 提示词版本表
export const promptVersions = pgTable('prompt_versions', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id').notNull().references(() => promptTemplates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  
  name: varchar('name', { length: 200 }).notNull(),
  content: text('content').notNull(),
  systemPrompt: text('system_prompt'),
  
  // 版本说明
  changeLog: text('change_log'),
  
  // 模型配置快照
  modelProvider: varchar('model_provider', { length: 50 }),
  modelName: varchar('model_name', { length: 100 }),
  temperature: varchar('temperature', { length: 10 }),
  maxTokens: integer('max_tokens'),
  outputFormat: varchar('output_format', { length: 50 }),
  
  authorId: integer('author_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    templateVersionIdx: uniqueIndex('prompt_versions_template_version_idx').on(table.templateId, table.version),
  };
});

// 角色模板映射表
export const promptRoleMappings = pgTable('prompt_role_mappings', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id').notNull().references(() => promptTemplates.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  
  // 优先级（同一角色多个模板时按优先级排序）
  priority: integer('priority').notNull().default(0),
  
  isDefault: boolean('is_default').notNull().default(false), // 是否为该角色默认模板
  isActive: boolean('is_active').notNull().default(true),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    templateRoleIdx: uniqueIndex('prompt_role_mappings_template_role_idx').on(table.templateId, table.roleId),
  };
});

// 方案生成记录表
export const schemeGenerations = pgTable('scheme_generations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  templateId: integer('template_id').references(() => promptTemplates.id, { onDelete: 'set null' }),
  templateVersion: integer('template_version'),
  chapterId: integer('chapter_id').references(() => bidChapters.id, { onDelete: 'set null' }), // 关联章节
  
  // 生成参数
  parameters: text('parameters'), // JSON格式存储使用的参数值
  
  // 生成内容
  title: varchar('title', { length: 300 }),
  content: text('content'), // 生成的内容
  
  // 模型信息
  modelProvider: varchar('model_provider', { length: 50 }),
  modelName: varchar('model_name', { length: 100 }),
  
  // 生成状态
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/generating/completed/failed
  errorMessage: text('error_message'),
  
  // Token统计
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  
  // 生成耗时
  duration: integer('duration'), // 毫秒
  
  // 是否已插入文档
  insertedToDoc: boolean('inserted_to_doc').notNull().default(false),
  docPath: varchar('doc_path', { length: 500 }), // 插入的文档路径
  
  // 公司归属
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 方案功能关系定义
// ============================================

// 提示词分类关系
export const promptCategoriesRelations = relations(promptCategories, ({ one, many }) => ({
  parent: one(promptCategories, {
    fields: [promptCategories.parentId],
    references: [promptCategories.id],
    relationName: 'prompt_category_hierarchy',
  }),
  children: many(promptCategories, { relationName: 'prompt_category_hierarchy' }),
  templates: many(promptTemplates),
}));

// 提示词模板关系
export const promptTemplatesRelations = relations(promptTemplates, ({ one, many }) => ({
  category: one(promptCategories, {
    fields: [promptTemplates.categoryId],
    references: [promptCategories.id],
  }),
  creator: one(users, {
    fields: [promptTemplates.createdBy],
    references: [users.id],
  }),
  parameters: many(promptParameters),
  versions: many(promptVersions),
  roleMappings: many(promptRoleMappings),
  generations: many(schemeGenerations),
}));

// 提示词参数关系
export const promptParametersRelations = relations(promptParameters, ({ one }) => ({
  template: one(promptTemplates, {
    fields: [promptParameters.templateId],
    references: [promptTemplates.id],
  }),
}));

// 提示词版本关系
export const promptVersionsRelations = relations(promptVersions, ({ one }) => ({
  template: one(promptTemplates, {
    fields: [promptVersions.templateId],
    references: [promptTemplates.id],
  }),
  author: one(users, {
    fields: [promptVersions.authorId],
    references: [users.id],
  }),
}));

// 角色模板映射关系
export const promptRoleMappingsRelations = relations(promptRoleMappings, ({ one }) => ({
  template: one(promptTemplates, {
    fields: [promptRoleMappings.templateId],
    references: [promptTemplates.id],
  }),
  role: one(roles, {
    fields: [promptRoleMappings.roleId],
    references: [roles.id],
  }),
  creator: one(users, {
    fields: [promptRoleMappings.createdBy],
    references: [users.id],
  }),
}));

// 方案生成记录关系
export const schemeGenerationsRelations = relations(schemeGenerations, ({ one }) => ({
  project: one(projects, {
    fields: [schemeGenerations.projectId],
    references: [projects.id],
  }),
  template: one(promptTemplates, {
    fields: [schemeGenerations.templateId],
    references: [promptTemplates.id],
  }),
  chapter: one(bidChapters, {
    fields: [schemeGenerations.chapterId],
    references: [bidChapters.id],
  }),
  company: one(companies, {
    fields: [schemeGenerations.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [schemeGenerations.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// AI编标记录表
// ============================================

export const aiGenerationLogs = pgTable('ai_generation_logs', {
  id: serial('id').primaryKey(),
  chapterId: integer('chapter_id').notNull().references(() => bidChapters.id, { onDelete: 'cascade' }),
  prompt: text('prompt'), // 使用的提示词
  model: varchar('model', { length: 100 }), // 使用的模型
  generatedContent: text('generated_content'), // 生成的内容
  isAccepted: boolean('is_accepted'), // 是否被采纳
  feedback: text('feedback'), // 用户反馈
  generatedBy: integer('generated_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// AI评测集表
// ============================================

export const aiEvaluationSets = pgTable('ai_evaluation_sets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(), // generation/qa/translation/summary
  testCaseCount: integer('test_case_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// AI测试用例表
// ============================================

export const aiTestCases = pgTable('ai_test_cases', {
  id: serial('id').primaryKey(),
  evaluationSetId: integer('evaluation_set_id').notNull().references(() => aiEvaluationSets.id, { onDelete: 'cascade' }),
  caseId: varchar('case_id', { length: 50 }).notNull(), // 用例编号
  input: text('input').notNull(), // 输入内容
  expectedOutput: text('expected_output'), // 预期输出
  criteria: text('criteria'), // JSON格式存储评估标准
  weight: integer('weight').notNull().default(1), // 权重
  tags: text('tags'), // JSON数组存储标签
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    setCaseIdx: uniqueIndex('ai_test_cases_set_case_idx').on(table.evaluationSetId, table.caseId),
  };
});

// ============================================
// AI测试运行表
// ============================================

export const aiTestRuns = pgTable('ai_test_runs', {
  id: serial('id').primaryKey(),
  evaluationSetId: integer('evaluation_set_id').notNull().references(() => aiEvaluationSets.id, { onDelete: 'cascade' }),
  modelId: varchar('model_id', { length: 100 }).notNull(), // 测试的模型
  parameters: text('parameters'), // JSON格式存储运行参数
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/running/completed/failed
  totalCases: integer('total_cases').notNull().default(0),
  passedCases: integer('passed_cases').notNull().default(0),
  failedCases: integer('failed_cases').notNull().default(0),
  avgScore: integer('avg_score'), // 平均得分
  avgLatency: integer('avg_latency'), // 平均响应时间（毫秒）
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// AI测试用例结果表
// ============================================

export const aiTestCaseResults = pgTable('ai_test_case_results', {
  id: serial('id').primaryKey(),
  testRunId: integer('test_run_id').notNull().references(() => aiTestRuns.id, { onDelete: 'cascade' }),
  testCaseId: integer('test_case_id').notNull().references(() => aiTestCases.id, { onDelete: 'cascade' }),
  caseCode: varchar('case_code', { length: 50 }).notNull(), // 测试用例编号
  input: text('input').notNull(), // 输入内容
  actualOutput: text('actual_output'), // 实际输出
  expectedOutput: text('expected_output'), // 预期输出
  score: integer('score'), // 得分 0-100
  passed: boolean('passed').notNull().default(false), // 是否通过
  latency: integer('latency'), // 响应时间（毫秒）
  tokenInput: integer('token_input'), // 输入token数
  tokenOutput: integer('token_output'), // 输出token数
  errorMessage: text('error_message'), // 错误信息
  evaluatedAt: timestamp('evaluated_at'), // 评估时间
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    testRunCaseIdx: uniqueIndex('ai_test_case_results_run_case_idx').on(table.testRunId, table.caseCode),
  };
});

// ============================================
// AI质量指标表
// ============================================

export const aiQualityMetrics = pgTable('ai_quality_metrics', {
  id: serial('id').primaryKey(),
  modelId: varchar('model_id', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 指标类别
  metricName: varchar('metric_name', { length: 100 }).notNull(), // 指标名称
  metricValue: integer('metric_value').notNull(), // 指标值
  threshold: integer('threshold').notNull().default(70), // 阈值
  description: text('description'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    modelMetricIdx: uniqueIndex('ai_quality_metrics_model_metric_idx').on(table.modelId, table.category, table.metricName),
  };
});

// ============================================
// 阶段3关系定义
// ============================================

// 标书文档关系
export const bidDocumentsRelations = relations(bidDocuments, ({ one, many }) => ({
  project: one(projects, {
    fields: [bidDocuments.projectId],
    references: [projects.id],
  }),
  publisher: one(users, {
    fields: [bidDocuments.publishedBy],
    references: [users.id],
    relationName: 'bid_doc_publisher',
  }),
  creator: one(users, {
    fields: [bidDocuments.createdBy],
    references: [users.id],
    relationName: 'bid_doc_creator',
  }),
  chapters: many(bidChapters),
  approvalFlows: many(approvalFlows),
  reviews: many(documentReviews),
  bidReviews: many(bidDocumentReviews),
  complianceChecks: many(complianceChecks),
  reviewReports: many(reviewReports),
  generationHistories: many(documentGenerationHistories),
}));

// 审校报告关系
export const reviewReportsRelations = relations(reviewReports, ({ one }) => ({
  document: one(bidDocuments, {
    fields: [reviewReports.documentId],
    references: [bidDocuments.id],
  }),
  creator: one(users, {
    fields: [reviewReports.createdBy],
    references: [users.id],
    relationName: 'report_creator',
  }),
  exporter: one(users, {
    fields: [reviewReports.exportedBy],
    references: [users.id],
    relationName: 'report_exporter',
  }),
}));

// 标书章节关系
export const bidChaptersRelations = relations(bidChapters, ({ one, many }) => ({
  document: one(bidDocuments, {
    fields: [bidChapters.documentId],
    references: [bidDocuments.id],
  }),
  parent: one(bidChapters, {
    fields: [bidChapters.parentId],
    references: [bidChapters.id],
    relationName: 'chapter_hierarchy',
  }),
  children: many(bidChapters, { relationName: 'chapter_hierarchy' }),
  assignee: one(users, {
    fields: [bidChapters.assignedTo],
    references: [users.id],
  }),
  responseItem: one(responseItems, {
    fields: [bidChapters.responseItemId],
    references: [responseItems.id],
  }),
  promptTemplate: one(promptTemplates, {
    fields: [bidChapters.promptTemplateId],
    references: [promptTemplates.id],
  }),
  company: one(companies, {
    fields: [bidChapters.companyId],
    references: [companies.id],
  }),
  approvalRecords: many(approvalRecords),
  aiLogs: many(aiGenerationLogs),
  generations: many(schemeGenerations),
}));

// 审核流程关系
export const approvalFlowsRelations = relations(approvalFlows, ({ one, many }) => ({
  document: one(bidDocuments, {
    fields: [approvalFlows.documentId],
    references: [bidDocuments.id],
  }),
  assignee: one(users, {
    fields: [approvalFlows.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [approvalFlows.createdBy],
    references: [users.id],
  }),
  records: many(approvalRecords),
}));

// 审核记录关系
export const approvalRecordsRelations = relations(approvalRecords, ({ one }) => ({
  flow: one(approvalFlows, {
    fields: [approvalRecords.flowId],
    references: [approvalFlows.id],
  }),
  chapter: one(bidChapters, {
    fields: [approvalRecords.chapterId],
    references: [bidChapters.id],
  }),
  reviewer: one(users, {
    fields: [approvalRecords.reviewerId],
    references: [users.id],
  }),
}));

// 文档审校关系
export const documentReviewsRelations = relations(documentReviews, ({ one }) => ({
  document: one(bidDocuments, {
    fields: [documentReviews.documentId],
    references: [bidDocuments.id],
  }),
  reviewer: one(users, {
    fields: [documentReviews.reviewedBy],
    references: [users.id],
  }),
}));

// AI生成文档审核关系
export const bidDocumentReviewsRelations = relations(bidDocumentReviews, ({ one }) => ({
  document: one(bidDocuments, {
    fields: [bidDocumentReviews.documentId],
    references: [bidDocuments.id],
  }),
  submitter: one(users, {
    fields: [bidDocumentReviews.submittedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [bidDocumentReviews.reviewerId],
    references: [users.id],
  }),
}));

// 文档生成历史关系
export const documentGenerationHistoriesRelations = relations(documentGenerationHistories, ({ one }) => ({
  document: one(bidDocuments, {
    fields: [documentGenerationHistories.documentId],
    references: [bidDocuments.id],
  }),
  interpretation: one(bidDocumentInterpretations, {
    fields: [documentGenerationHistories.interpretationId],
    references: [bidDocumentInterpretations.id],
  }),
  creator: one(users, {
    fields: [documentGenerationHistories.createdBy],
    references: [users.id],
  }),
}));

// 合规检查关系
export const complianceChecksRelations = relations(complianceChecks, ({ one }) => ({
  document: one(bidDocuments, {
    fields: [complianceChecks.documentId],
    references: [bidDocuments.id],
  }),
  chapter: one(bidChapters, {
    fields: [complianceChecks.chapterId],
    references: [bidChapters.id],
  }),
  resolver: one(users, {
    fields: [complianceChecks.resolvedBy],
    references: [users.id],
  }),
}));

// 编标模板关系
export const bidTemplatesRelations = relations(bidTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [bidTemplates.createdBy],
    references: [users.id],
  }),
}));

// AI生成记录关系
export const aiGenerationLogsRelations = relations(aiGenerationLogs, ({ one }) => ({
  chapter: one(bidChapters, {
    fields: [aiGenerationLogs.chapterId],
    references: [bidChapters.id],
  }),
  generator: one(users, {
    fields: [aiGenerationLogs.generatedBy],
    references: [users.id],
  }),
}));

// ============================================
// 类型导出
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type ProjectPhase = typeof projectPhases.$inferSelect;
export type NewProjectPhase = typeof projectPhases.$inferInsert;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type NewProjectMilestone = typeof projectMilestones.$inferInsert;
export type FileCategory = typeof fileCategories.$inferSelect;
export type NewFileCategory = typeof fileCategories.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type FileVersion = typeof fileVersions.$inferSelect;
export type NewFileVersion = typeof fileVersions.$inferInsert;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type NewProjectFile = typeof projectFiles.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
// 阶段2新增类型
export type ParseTask = typeof parseTasks.$inferSelect;
export type NewParseTask = typeof parseTasks.$inferInsert;
export type ParseResult = typeof parseResults.$inferSelect;
export type NewParseResult = typeof parseResults.$inferInsert;
export type ParseItem = typeof parseItems.$inferSelect;
export type NewParseItem = typeof parseItems.$inferInsert;
export type ResponseMatrix = typeof responseMatrices.$inferSelect;
export type NewResponseMatrix = typeof responseMatrices.$inferInsert;
export type ResponseItem = typeof responseItems.$inferSelect;
export type NewResponseItem = typeof responseItems.$inferInsert;
export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type NewKnowledgeCategory = typeof knowledgeCategories.$inferInsert;
export type KnowledgeTag = typeof knowledgeTags.$inferSelect;
export type NewKnowledgeTag = typeof knowledgeTags.$inferInsert;
export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
export type NewKnowledgeItem = typeof knowledgeItems.$inferInsert;
export type KnowledgeItemTag = typeof knowledgeItemTags.$inferSelect;
export type NewKnowledgeItemTag = typeof knowledgeItemTags.$inferInsert;
export type KnowledgeVersion = typeof knowledgeVersions.$inferSelect;
export type NewKnowledgeVersion = typeof knowledgeVersions.$inferInsert;
// 阶段3新增类型
export type BidDocument = typeof bidDocuments.$inferSelect;
export type NewBidDocument = typeof bidDocuments.$inferInsert;
export type BidChapter = typeof bidChapters.$inferSelect;
export type NewBidChapter = typeof bidChapters.$inferInsert;
export type ApprovalFlow = typeof approvalFlows.$inferSelect;
export type NewApprovalFlow = typeof approvalFlows.$inferInsert;
export type ApprovalRecord = typeof approvalRecords.$inferSelect;
export type NewApprovalRecord = typeof approvalRecords.$inferInsert;
export type DocumentReview = typeof documentReviews.$inferSelect;
export type NewDocumentReview = typeof documentReviews.$inferInsert;
export type ComplianceCheck = typeof complianceChecks.$inferSelect;
export type NewComplianceCheck = typeof complianceChecks.$inferInsert;
export type BidTemplate = typeof bidTemplates.$inferSelect;
export type NewBidTemplate = typeof bidTemplates.$inferInsert;
export type AIGenerationLog = typeof aiGenerationLogs.$inferSelect;
export type NewAIGenerationLog = typeof aiGenerationLogs.$inferInsert;

// ============================================
// 过程记录表 - 会议纪要
// ============================================

export const meetingMinutes = pgTable('meeting_minutes', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  meetingDate: timestamp('meeting_date').notNull(),
  participants: text('participants'), // JSON数组存储参会人员
  location: varchar('location', { length: 200 }),
  meetingType: varchar('meeting_type', { length: 50 }), // kickoff/review/coordination/other
  attachments: text('attachments'), // JSON数组存储附件信息
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 过程记录表 - 客户对接记录
// ============================================

export const contactRecords = pgTable('contact_records', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  contactType: varchar('contact_type', { length: 50 }).notNull(), // phone/email/meeting/site_visit
  contactDate: timestamp('contact_date').notNull(),
  contactPerson: varchar('contact_person', { length: 100 }).notNull(), // 客户方联系人
  contactOrg: varchar('contact_org', { length: 200 }), // 客户方单位
  ourPerson: varchar('our_person', { length: 100 }).notNull(), // 我方联系人
  content: text('content').notNull(), // 对接内容
  result: text('result'), // 对接结果
  followUp: text('follow_up'), // 后续跟进事项
  nextContactDate: timestamp('next_contact_date'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 过程记录表 - 项目任务
// ============================================

export const projectTasks = pgTable('project_tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  phaseId: integer('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  assigneeId: integer('assignee_id').references(() => users.id),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'), // high/medium/low
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/in_progress/completed/cancelled
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  parentId: integer('parent_id').references((): any => projectTasks.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 过程记录关系定义
// ============================================

export const meetingMinutesRelations = relations(meetingMinutes, ({ one, many }) => ({
  project: one(projects, {
    fields: [meetingMinutes.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [meetingMinutes.createdBy],
    references: [users.id],
  }),
}));

export const contactRecordsRelations = relations(contactRecords, ({ one, many }) => ({
  project: one(projects, {
    fields: [contactRecords.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [contactRecords.createdBy],
    references: [users.id],
  }),
}));

export const projectTasksRelations = relations(projectTasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectTasks.projectId],
    references: [projects.id],
  }),
  phase: one(projectPhases, {
    fields: [projectTasks.phaseId],
    references: [projectPhases.id],
  }),
  assignee: one(users, {
    fields: [projectTasks.assigneeId],
    references: [users.id],
  }),
  parent: one(projectTasks, {
    fields: [projectTasks.parentId],
    references: [projectTasks.id],
    relationName: 'task_hierarchy',
  }),
  children: many(projectTasks, {
    relationName: 'task_hierarchy',
  }),
  creator: one(users, {
    fields: [projectTasks.createdBy],
    references: [users.id],
  }),
}));

// 项目标签关系
export const projectTagsRelations = relations(projectTags, ({ many }) => ({
  projectRelations: many(projectTagRelations),
}));

export const projectTagRelationsRelations = relations(projectTagRelations, ({ one }) => ({
  project: one(projects, {
    fields: [projectTagRelations.projectId],
    references: [projects.id],
  }),
  tag: one(projectTags, {
    fields: [projectTagRelations.tagId],
    references: [projectTags.id],
  }),
  addedByUser: one(users, {
    fields: [projectTagRelations.addedBy],
    references: [users.id],
  }),
}));

// ============================================
// 过程记录类型导出
// ============================================

export type MeetingMinute = typeof meetingMinutes.$inferSelect;
export type NewMeetingMinute = typeof meetingMinutes.$inferInsert;
export type ContactRecord = typeof contactRecords.$inferSelect;
export type NewContactRecord = typeof contactRecords.$inferInsert;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type NewProjectTask = typeof projectTasks.$inferInsert;

// ============================================
// 项目标签类型导出
// ============================================

export type ProjectTag = typeof projectTags.$inferSelect;
export type NewProjectTag = typeof projectTags.$inferInsert;
export type ProjectTagRelation = typeof projectTagRelations.$inferSelect;
export type NewProjectTagRelation = typeof projectTagRelations.$inferInsert;

// ============================================
// 历史报价记录表 - 用于智能报价分析
// ============================================

export const historicalQuotes = pgTable('historical_quotes', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  
  // 项目基本信息
  projectName: varchar('project_name', { length: 200 }).notNull(),
  tenderCode: varchar('tender_code', { length: 100 }), // 招标编号
  tenderOrganization: varchar('tender_organization', { length: 200 }), // 招标单位
  industry: varchar('industry', { length: 50 }), // 行业
  region: varchar('region', { length: 50 }), // 地区
  projectType: varchar('project_type', { length: 50 }), // 项目类型
  
  // 报价信息
  budget: decimal('budget', { precision: 15, scale: 2 }), // 预算金额
  ourQuote: decimal('our_quote', { precision: 15, scale: 2 }).notNull(), // 我方报价
  winningQuote: decimal('winning_quote', { precision: 15, scale: 2 }), // 中标报价
  avgQuote: decimal('avg_quote', { precision: 15, scale: 2 }), // 平均报价
  lowestQuote: decimal('lowest_quote', { precision: 15, scale: 2 }), // 最低报价
  highestQuote: decimal('highest_quote', { precision: 15, scale: 2 }), // 最高报价
  bidderCount: integer('bidder_count'), // 投标人数
  
  // 结果信息
  result: varchar('result', { length: 20 }).notNull(), // won/lost/withdrawn
  resultRank: integer('result_rank'), // 排名
  scoreGap: decimal('score_gap', { precision: 5, scale: 2 }), // 与中标分差
  
  // 分析字段
  quoteDeviation: decimal('quote_deviation', { precision: 5, scale: 2 }), // 报价偏差率
  winProbability: decimal('win_probability', { precision: 5, scale: 2 }), // 中标概率
  analysisNotes: text('analysis_notes'), // 分析备注
  
  bidDate: timestamp('bid_date'), // 投标日期
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 竞争对手投标记录关联表（旧表，保留兼容）
// ============================================

export const competitorBids = pgTable('competitor_bids', {
  id: serial('id').primaryKey(),
  competitorId: integer('competitor_id').notNull().references(() => competitors.id),
  quoteId: integer('quote_id').references(() => historicalQuotes.id),
  
  projectName: varchar('project_name', { length: 200 }).notNull(),
  tenderCode: varchar('tender_code', { length: 100 }),
  bidDate: timestamp('bid_date'),
  
  quote: decimal('quote', { precision: 15, scale: 2 }), // 报价
  result: varchar('result', { length: 20 }), // won/lost/unknown
  rank: integer('rank'), // 排名
  
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 提醒规则配置表
// ============================================

export const reminderRules = pgTable('reminder_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(), // milestone/deadline/approval/custom
  
  // 触发条件
  condition: text('condition').notNull(), // JSON格式存储条件
  advanceDays: integer('advance_days').notNull().default(3), // 提前天数
  repeatDays: integer('repeat_days'), // 重复提醒间隔
  
  // 通知设置
  channels: varchar('channels', { length: 50 }).notNull().default('web'),
  isActive: boolean('is_active').notNull().default(true),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// decimal 类型辅助函数
// ============================================

function decimal(name: string, options: { precision: number; scale: number }) {
  // 使用 numeric 作为 PostgreSQL 的 decimal 类型
  return text(name); // 简化处理，实际使用时转换为数字
}

// ============================================
// 标签分类表
// ============================================

export const tagCategories = pgTable('tag_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: text('description'),
  icon: varchar('icon', { length: 100 }),
  color: varchar('color', { length: 20 }).notNull().default('#6366f1'),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 关联实体类型：prompt_template/document/bid_document/project等
  parent_id: integer('parent_id'), // 支持分类层级
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 统一标签表
// ============================================

export const unifiedTags = pgTable('unified_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 100 }), // 可选的唯一标识
  slug: varchar('slug', { length: 150 }), // URL友好标识
  
  // 分类关联
  categoryId: integer('category_id').references(() => tagCategories.id),
  
  // 层级支持（目录结构）
  parentId: integer('parent_id'),
  
  // 标签属性
  type: varchar('type', { length: 30 }).notNull().default('tag'), // tag/directory
  color: varchar('color', { length: 20 }).notNull().default('#6366f1'),
  icon: varchar('icon', { length: 100 }),
  description: text('description'),
  
  // 适用范围
  entityTypes: text('entity_types'), // JSON数组，适用的实体类型列表
  
  // 统计
  useCount: integer('use_count').notNull().default(0),
  
  // 状态
  isSystem: boolean('is_system').notNull().default(false), // 系统内置标签
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    nameIdx: uniqueIndex('unified_tags_name_idx').on(table.name, table.categoryId),
    codeIdx: uniqueIndex('unified_tags_code_idx').on(table.code),
    slugIdx: uniqueIndex('unified_tags_slug_idx').on(table.slug),
  };
});

// ============================================
// 实体标签关联表（通用）
// ============================================

export const entityTags = pgTable('entity_tags', {
  id: serial('id').primaryKey(),
  
  // 多态关联
  entityType: varchar('entity_type', { length: 50 }).notNull(), // prompt_template/document/bid_document/project等
  entityId: integer('entity_id').notNull(),
  
  // 标签关联
  tagId: integer('tag_id').notNull().references(() => unifiedTags.id, { onDelete: 'cascade' }),
  
  // 元数据
  addedBy: integer('added_by').references(() => users.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => {
  return {
    entityTagIdx: uniqueIndex('entity_tags_entity_tag_idx').on(table.entityType, table.entityId, table.tagId),
    entityIdx: uniqueIndex('entity_tags_entity_idx').on(table.entityType, table.entityId),
    tagIdx: uniqueIndex('entity_tags_tag_idx').on(table.tagId),
  };
});

// ============================================
// 标签关系定义
// ============================================

export const tagCategoriesRelations = relations(tagCategories, ({ one, many }) => ({
  parent: one(tagCategories, {
    fields: [tagCategories.parent_id],
    references: [tagCategories.id],
    relationName: 'tag_category_hierarchy',
  }),
  children: many(tagCategories, { relationName: 'tag_category_hierarchy' }),
  tags: many(unifiedTags),
  creator: one(users, {
    fields: [tagCategories.createdBy],
    references: [users.id],
  }),
}));

export const unifiedTagsRelations = relations(unifiedTags, ({ one, many }) => ({
  category: one(tagCategories, {
    fields: [unifiedTags.categoryId],
    references: [tagCategories.id],
  }),
  parent: one(unifiedTags, {
    fields: [unifiedTags.parentId],
    references: [unifiedTags.id],
    relationName: 'tag_hierarchy',
  }),
  children: many(unifiedTags, { relationName: 'tag_hierarchy' }),
  creator: one(users, {
    fields: [unifiedTags.createdBy],
    references: [users.id],
  }),
  entityTags: many(entityTags),
}));

export const entityTagsRelations = relations(entityTags, ({ one }) => ({
  tag: one(unifiedTags, {
    fields: [entityTags.tagId],
    references: [unifiedTags.id],
  }),
  adder: one(users, {
    fields: [entityTags.addedBy],
    references: [users.id],
  }),
}));

// ============================================
// 标签类型导出
// ============================================

export type TagCategory = typeof tagCategories.$inferSelect;
export type NewTagCategory = typeof tagCategories.$inferInsert;
export type UnifiedTag = typeof unifiedTags.$inferSelect;
export type NewUnifiedTag = typeof unifiedTags.$inferInsert;
export type EntityTag = typeof entityTags.$inferSelect;
export type NewEntityTag = typeof entityTags.$inferInsert;

// ============================================
// 文档框架模板分类表
// ============================================

export const chapterTemplateCategories = pgTable('chapter_template_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }),
  color: varchar('color', { length: 20 }).default('#6366f1'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  isSystem: boolean('is_system').default(false),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 章节模板表
export const chapterTemplates = pgTable('chapter_templates', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => chapterTemplateCategories.id),
  
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 100 }).unique(),
  description: text('description'),
  
  // 模板内容
  level: integer('level').notNull().default(1),
  contentType: varchar('content_type', { length: 50 }).default('text'),
  required: boolean('required').default(false),
  contentTemplate: text('content_template'),
  
  // 占位符配置
  placeholders: text('placeholders'), // JSON数组存储占位符名称
  
  // 子模板
  hasChildren: boolean('has_children').default(false),
  childrenConfig: text('children_config'), // JSON数组存储子模板配置
  
  // 状态
  isSystem: boolean('is_system').default(false),
  isActive: boolean('is_active').default(true),
  useCount: integer('use_count').default(0),
  sortOrder: integer('sort_order').default(0),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// 文档框架模板分类关系定义
// ============================================

export const chapterTemplateCategoriesRelations = relations(chapterTemplateCategories, ({ one, many }) => ({
  creator: one(users, {
    fields: [chapterTemplateCategories.createdBy],
    references: [users.id],
  }),
  templates: many(chapterTemplates),
}));

export const chapterTemplatesRelations = relations(chapterTemplates, ({ one }) => ({
  category: one(chapterTemplateCategories, {
    fields: [chapterTemplates.categoryId],
    references: [chapterTemplateCategories.id],
  }),
  creator: one(users, {
    fields: [chapterTemplates.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// 文档框架模板类型导出
// ============================================

export type ChapterTemplateCategory = typeof chapterTemplateCategories.$inferSelect;
export type NewChapterTemplateCategory = typeof chapterTemplateCategories.$inferInsert;
export type ChapterTemplate = typeof chapterTemplates.$inferSelect;
export type NewChapterTemplate = typeof chapterTemplates.$inferInsert;

// ============================================
// 文档框架表
// ============================================

export const docFrameworks = pgTable('doc_frameworks', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  description: text('description'),
  category: varchar('category', { length: 50 }).default('general'),
  status: varchar('status', { length: 20 }).default('draft'),
  
  // 配置项（JSON格式）
  coverConfig: text('cover_config').default('{}'),
  titlePageConfig: text('title_page_config').default('{}'),
  headerConfig: text('header_config').default('{}'),
  footerConfig: text('footer_config').default('{}'),
  tocConfig: text('toc_config').default('{}'),
  bodyConfig: text('body_config').default('{}'),
  
  version: integer('version').default(1),
  isSystem: boolean('is_system').default(false),
  
  // 公司专属框架
  companyId: integer('company_id').references(() => companies.id),
  isDefault: boolean('is_default').default(false),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 文档框架章节表
export const docFrameworkChapters = pgTable('doc_framework_chapters', {
  id: serial('id').primaryKey(),
  frameworkId: integer('framework_id').notNull().references(() => docFrameworks.id, { onDelete: 'cascade' }),
  
  title: varchar('title', { length: 500 }).notNull(),
  level: integer('level').notNull().default(1),
  sequence: integer('sequence').notNull().default(0),
  parentId: integer('parent_id'),
  
  chapterCode: varchar('chapter_code', { length: 50 }),
  contentType: varchar('content_type', { length: 50 }).default('text'),
  required: boolean('required').default(false),
  wordCountMin: integer('word_count_min'),
  wordCountMax: integer('word_count_max'),
  
  contentTemplate: text('content_template'),
  styleConfig: text('style_config').default('{}'),
  
  isPlaceholder: boolean('is_placeholder').default(false),
  placeholderHint: text('placeholder_hint'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 文档框架实例表
export const docFrameworkInstances = pgTable('doc_framework_instances', {
  id: serial('id').primaryKey(),
  frameworkId: integer('framework_id').notNull().references(() => docFrameworks.id),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  bidDocumentId: integer('bid_document_id').references(() => bidDocuments.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 200 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft'),
  
  generatedContent: text('generated_content').default('{}'),
  
  totalChapters: integer('total_chapters').default(0),
  completedChapters: integer('completed_chapters').default(0),
  totalWords: integer('total_words').default(0),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 文档框架章节内容表
export const docFrameworkContents = pgTable('doc_framework_contents', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').notNull().references(() => docFrameworkInstances.id, { onDelete: 'cascade' }),
  chapterId: integer('chapter_id').notNull().references(() => docFrameworkChapters.id, { onDelete: 'cascade' }),
  
  content: text('content'),
  wordCount: integer('word_count').default(0),
  status: varchar('status', { length: 20 }).default('pending'),
  
  generatedByAI: boolean('generated_by_ai').default(false),
  generationPrompt: text('generation_prompt'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  instanceChapterUnique: uniqueIndex('instance_chapter_unique').on(table.instanceId, table.chapterId),
}));

// ============================================
// 文档框架关系定义
// ============================================

export const docFrameworksRelations = relations(docFrameworks, ({ one, many }) => ({
  company: one(companies, {
    fields: [docFrameworks.companyId],
    references: [companies.id],
  }),
  chapters: many(docFrameworkChapters),
  instances: many(docFrameworkInstances),
}));

export const docFrameworkChaptersRelations = relations(docFrameworkChapters, ({ one, many }) => ({
  framework: one(docFrameworks, {
    fields: [docFrameworkChapters.frameworkId],
    references: [docFrameworks.id],
  }),
  parent: one(docFrameworkChapters, {
    fields: [docFrameworkChapters.parentId],
    references: [docFrameworkChapters.id],
  }),
  children: many(docFrameworkChapters),
  contents: many(docFrameworkContents),
}));

export const docFrameworkInstancesRelations = relations(docFrameworkInstances, ({ one, many }) => ({
  framework: one(docFrameworks, {
    fields: [docFrameworkInstances.frameworkId],
    references: [docFrameworks.id],
  }),
  project: one(projects, {
    fields: [docFrameworkInstances.projectId],
    references: [projects.id],
  }),
  bidDocument: one(bidDocuments, {
    fields: [docFrameworkInstances.bidDocumentId],
    references: [bidDocuments.id],
  }),
  contents: many(docFrameworkContents),
}));

export const docFrameworkContentsRelations = relations(docFrameworkContents, ({ one }) => ({
  instance: one(docFrameworkInstances, {
    fields: [docFrameworkContents.instanceId],
    references: [docFrameworkInstances.id],
  }),
  chapter: one(docFrameworkChapters, {
    fields: [docFrameworkContents.chapterId],
    references: [docFrameworkChapters.id],
  }),
}));

// ============================================
// 文档框架类型导出
// ============================================

export type DocFramework = typeof docFrameworks.$inferSelect;
export type NewDocFramework = typeof docFrameworks.$inferInsert;
export type DocFrameworkChapter = typeof docFrameworkChapters.$inferSelect;
export type NewDocFrameworkChapter = typeof docFrameworkChapters.$inferInsert;
export type DocFrameworkInstance = typeof docFrameworkInstances.$inferSelect;
export type NewDocFrameworkInstance = typeof docFrameworkInstances.$inferInsert;
export type DocFrameworkContent = typeof docFrameworkContents.$inferSelect;
export type NewDocFrameworkContent = typeof docFrameworkContents.$inferInsert;

// ============================================
// 最近访问记录表
// ============================================

export const recentVisits = pgTable('recent_visits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 多态关联
  entityType: varchar('entity_type', { length: 50 }).notNull(), // tag/category/template/project/document等
  entityId: integer('entity_id').notNull(),
  
  // 元数据
  entityName: varchar('entity_name', { length: 200 }), // 冗余存储，方便显示
  entityData: text('entity_data'), // JSON格式存储额外信息
  
  visitCount: integer('visit_count').notNull().default(1),
  lastVisitedAt: timestamp('last_visited_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    userEntityIdx: uniqueIndex('recent_visits_user_entity_idx').on(table.userId, table.entityType, table.entityId),
    userLastVisitedIdx: uniqueIndex('recent_visits_user_last_visited_idx').on(table.userId, table.lastVisitedAt),
  };
});

// ============================================
// 筛选方案保存表
// ============================================

export const savedFilters = pgTable('saved_filters', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // tag/template/project/document等
  
  // 筛选条件（JSON格式）
  filters: text('filters').notNull(), // JSON对象存储筛选条件
  
  isDefault: boolean('is_default').default(false),
  sortOrder: integer('sort_order').default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    userEntityTypeIdx: uniqueIndex('saved_filters_user_entity_type_idx').on(table.userId, table.entityType),
  };
});

// ============================================
// 收藏表
// ============================================

export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 多态关联
  entityType: varchar('entity_type', { length: 50 }).notNull(), // tag/category/template/project/document等
  entityId: integer('entity_id').notNull(),
  
  // 元数据
  entityName: varchar('entity_name', { length: 200 }), // 冗余存储，方便显示
  note: text('note'), // 收藏备注
  
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    userEntityIdx: uniqueIndex('favorites_user_entity_idx').on(table.userId, table.entityType, table.entityId),
    userIdx: uniqueIndex('favorites_user_idx').on(table.userId, table.createdAt),
  };
});

// ============================================
// 操作日志表
// ============================================

export const operationLogs = pgTable('operation_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // 操作类型
  action: varchar('action', { length: 50 }).notNull(), // create/update/delete/view/export/import等
  entityType: varchar('entity_type', { length: 50 }).notNull(), // tag/template/project/document等
  entityId: integer('entity_id'),
  
  // 操作详情
  entityName: varchar('entity_name', { length: 200 }),
  oldValue: text('old_value'), // JSON格式存储变更前的值
  newValue: text('new_value'), // JSON格式存储变更后的值
  
  // 请求信息
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    userIdx: uniqueIndex('operation_logs_user_idx').on(table.userId, table.createdAt),
    entityTypeIdx: uniqueIndex('operation_logs_entity_type_idx').on(table.entityType, table.entityId),
  };
});

// ============================================
// 标签版本历史表
// ============================================

export const tagVersions = pgTable('tag_versions', {
  id: serial('id').primaryKey(),
  tagId: integer('tag_id').notNull().references(() => unifiedTags.id, { onDelete: 'cascade' }),
  
  version: integer('version').notNull(), // 版本号
  snapshot: text('snapshot').notNull(), // JSON格式存储标签快照
  
  changeSummary: text('change_summary'), // 变更摘要
  changedBy: integer('changed_by').references(() => users.id),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
}, (table) => {
  return {
    tagVersionIdx: uniqueIndex('tag_versions_tag_version_idx').on(table.tagId, table.version),
  };
});

// ============================================
// 关系定义
// ============================================

export const recentVisitsRelations = relations(recentVisits, ({ one }) => ({
  user: one(users, {
    fields: [recentVisits.userId],
    references: [users.id],
  }),
}));

export const savedFiltersRelations = relations(savedFilters, ({ one }) => ({
  user: one(users, {
    fields: [savedFilters.userId],
    references: [users.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
}));

export const operationLogsRelations = relations(operationLogs, ({ one }) => ({
  user: one(users, {
    fields: [operationLogs.userId],
    references: [users.id],
  }),
}));

export const tagVersionsRelations = relations(tagVersions, ({ one }) => ({
  tag: one(unifiedTags, {
    fields: [tagVersions.tagId],
    references: [unifiedTags.id],
  }),
  changer: one(users, {
    fields: [tagVersions.changedBy],
    references: [users.id],
  }),
}));

// ============================================
// 类型导出
// ============================================

export type RecentVisit = typeof recentVisits.$inferSelect;
export type NewRecentVisit = typeof recentVisits.$inferInsert;
export type SavedFilter = typeof savedFilters.$inferSelect;
export type NewSavedFilter = typeof savedFilters.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type OperationLog = typeof operationLogs.$inferSelect;
export type NewOperationLog = typeof operationLogs.$inferInsert;
export type TagVersion = typeof tagVersions.$inferSelect;
export type NewTagVersion = typeof tagVersions.$inferInsert;

// ============================================
// 公司信息管理模块
// ============================================

// 公司文件类型枚举
export const companyFileTypeEnum = pgEnum('company_file_type', [
  'business_license',     // 营业执照
  'business_certificate', // 商务资质证书
  'personnel_certificate', // 人员资质
  'performance_scan',     // 业绩扫描件
  'contract',             // 合同文件
  'financial_statement',  // 财务报表
  'tax_certificate',      // 税务证明
  'other',                // 其他文件
]);

// ============================================
// 公司信息表
// ============================================

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 200 }).notNull(), // 公司名称
  shortName: varchar('short_name', { length: 50 }), // 公司简称
  creditCode: varchar('credit_code', { length: 50 }).notNull().unique(), // 统一社会信用代码
  registerAddress: varchar('register_address', { length: 500 }).notNull(), // 注册地址
  officeAddress: varchar('office_address', { length: 500 }), // 办公地址
  
  // 法定代表人信息
  legalPersonName: varchar('legal_person_name', { length: 50 }).notNull(), // 法定代表人姓名
  legalPersonIdCard: varchar('legal_person_id_card', { length: 32 }), // 法定代表人身份证号
  
  // 代理人信息
  agentName: varchar('agent_name', { length: 50 }), // 代理人姓名
  agentIdCard: varchar('agent_id_card', { length: 32 }), // 代理人身份证号
  
  // 接口人信息
  contactPersonName: varchar('contact_person_name', { length: 50 }).notNull(), // 接口人姓名
  contactPersonDept: varchar('contact_person_dept', { length: 100 }), // 接口人部门
  contactPersonPosition: varchar('contact_person_position', { length: 50 }), // 接口人职务
  contactPersonPhone: varchar('contact_person_phone', { length: 20 }), // 接口人电话
  contactPersonEmail: varchar('contact_person_email', { length: 100 }), // 接口人邮箱
  contactPersonWechat: varchar('contact_person_wechat', { length: 50 }), // 接口人微信
  
  // 公司属性
  industry: varchar('industry', { length: 50 }), // 所属行业
  companyType: varchar('company_type', { length: 50 }), // 企业类型
  registeredCapital: varchar('registered_capital', { length: 50 }), // 注册资本
  establishDate: timestamp('establish_date'), // 成立日期
  businessScope: text('business_scope'), // 经营范围
  
  // 银行信息
  bankName: varchar('bank_name', { length: 100 }), // 开户银行
  bankAccount: varchar('bank_account', { length: 50 }), // 银行账号
  
  // 税务信息
  taxId: varchar('tax_id', { length: 50 }), // 税号（与creditCode相同，保留用于兼容）
  taxpayerType: varchar('taxpayer_type', { length: 20 }), // 纳税人类型
  
  // 描述与备注
  description: text('description'), // 公司描述
  remarks: text('remarks'), // 备注
  
  // 状态
  isDefault: boolean('is_default').default(false), // 是否默认公司
  isActive: boolean('is_active').default(true), // 是否启用
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  nameIdx: uniqueIndex('companies_name_idx').on(table.name),
  creditCodeIdx: uniqueIndex('companies_credit_code_idx').on(table.creditCode),
  createdByIdx: uniqueIndex('companies_created_by_idx').on(table.createdBy),
}));

// ============================================
// 公司对接人角色表
// ============================================

// 对接人角色类型枚举
export const contactRoleTypeEnum = pgEnum('contact_role_type', [
  'bid_contact',      // 投标对接人
  'document_prep',    // 资料准备负责人
  'bid_purchase',     // 买标书负责人
  'stamp_person',     // 盖章负责人
  'bid_agent',        // 投标代理人
  'legal_person',     // 法定代表人
  'sales',            // 销售
  'finance',          // 财务
  'other',            // 其他
]);

export const companyContactRoles = pgTable('company_contact_roles', {
  id: serial('id').primaryKey(),
  
  // 角色信息
  name: varchar('name', { length: 50 }).notNull(), // 角色名称
  code: varchar('code', { length: 50 }).notNull(), // 角色代码
  type: contactRoleTypeEnum('type').notNull(), // 角色类型
  isSystem: boolean('is_system').default(false), // 是否系统预设角色
  description: varchar('description', { length: 200 }), // 角色描述
  sortOrder: integer('sort_order').default(0), // 排序
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: uniqueIndex('company_contact_roles_code_idx').on(table.code),
}));

// ============================================
// 公司对接人表
// ============================================

export const companyContacts = pgTable('company_contacts', {
  id: serial('id').primaryKey(),
  
  // 关联公司
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  
  // 基本信息
  name: varchar('name', { length: 50 }).notNull(), // 姓名
  department: varchar('department', { length: 100 }), // 部门
  position: varchar('position', { length: 50 }), // 职务
  
  // 联系方式
  phone: varchar('phone', { length: 20 }), // 手机
  telephone: varchar('telephone', { length: 20 }), // 座机
  wechat: varchar('wechat', { length: 50 }), // 微信
  qq: varchar('qq', { length: 20 }), // QQ
  email: varchar('email', { length: 100 }), // 邮箱
  
  // 角色（JSON数组，支持多角色）
  roles: text('roles'), // JSON数组: [{"id": 1, "name": "投标对接人"}, ...]
  
  // 备注
  remarks: text('remarks'), // 备注
  
  // 状态
  isPrimary: boolean('is_primary').default(false), // 是否主要对接人
  isActive: boolean('is_active').default(true), // 是否启用
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  companyIdx: index('company_contacts_company_idx').on(table.companyId),
}));

// ============================================
// 购买招标文件安排表
// ============================================

// 购买状态枚举
export const bidDocPurchaseStatusEnum = pgEnum('bid_doc_purchase_status', [
  'pending',     // 待购买
  'completed',   // 已完成
  'cancelled',   // 已取消
]);

// 购买招标文件安排表
export const bidDocumentPurchases = pgTable('bid_document_purchases', {
  id: serial('id').primaryKey(),
  
  // 项目信息
  projectId: integer('project_id').references(() => projects.id), // 关联项目（可选）
  projectName: varchar('project_name', { length: 200 }).notNull(), // 项目名称
  projectCode: varchar('project_code', { length: 100 }), // 项目编号
  
  // 时间安排
  purchaseDeadline: timestamp('purchase_deadline'), // 购买截止时间
  plannedDate: timestamp('planned_date'), // 计划购买日期
  actualDate: timestamp('actual_date'), // 实际购买日期
  
  // 对接主体（政采/招标代理机构）
  platformId: integer('platform_id'), // 关联政采单位ID（不强制外键）
  platformName: varchar('platform_name', { length: 200 }), // 对接单位名称（冗余）
  platformAddress: varchar('platform_address', { length: 500 }), // 单位地址（同步）
  platformContact: varchar('platform_contact', { length: 50 }), // 对接人
  platformPhone: varchar('platform_phone', { length: 50 }), // 联系电话
  
  // 我方负责人
  ourContactId: integer('our_contact_id').references(() => users.id), // 我方负责人（用户）
  ourContactName: varchar('our_contact_name', { length: 50 }), // 我方负责人姓名
  ourContactPhone: varchar('our_contact_phone', { length: 20 }), // 我方负责人电话
  
  // 友司信息（联动公司管理）
  partnerCompanyId: integer('partner_company_id').references(() => companies.id), // 友司公司
  partnerCompanyName: varchar('partner_company_name', { length: 200 }), // 友司公司名称
  partnerContactId: integer('partner_contact_id'), // 友司对接人（关联company_contacts）
  partnerContactName: varchar('partner_contact_name', { length: 50 }), // 友司对接人姓名
  partnerContactPhone: varchar('partner_contact_phone', { length: 20 }), // 友司对接人电话
  
  // 任务指派
  assigneeId: integer('assignee_id').references(() => users.id), // 指派给谁
  assigneeName: varchar('assignee_name', { length: 50 }), // 指派人姓名（冗余）
  priority: varchar('priority', { length: 20 }).default('medium'), // 优先级: high/medium/low
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id), // 关联的任务ID
  pushedToTask: boolean('pushed_to_task').default(false), // 是否已推送到任务中心
  pushedAt: timestamp('pushed_at'), // 推送时间
  
  // 所需材料提醒（JSON数组）
  requiredMaterials: text('required_materials'), // 所需材料清单 JSON
  
  // 备注
  remarks: text('remarks'), // 备注说明
  
  // 状态
  status: bidDocPurchaseStatusEnum('status').default('pending').notNull(), // 购买状态
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  // 完成时间
  completedAt: timestamp('completed_at'), // 完成时间
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('bid_doc_purchases_project_idx').on(table.projectId),
  platformIdx: index('bid_doc_purchases_platform_idx').on(table.platformId),
  statusIdx: index('bid_doc_purchases_status_idx').on(table.status),
  assigneeIdx: index('bid_doc_purchases_assignee_idx').on(table.assigneeId),
  taskIdx: index('bid_doc_purchases_task_idx').on(table.taskId),
}));

// ============================================
// 打印标书安排表
// ============================================

// 打印状态枚举
export const bidPrintingStatusEnum = pgEnum('bid_printing_status', [
  'pending',     // 待打印
  'printing',    // 打印中
  'completed',   // 已完成
  'cancelled',   // 已取消
]);

// 打印方式枚举
export const printingMethodEnum = pgEnum('printing_method', [
  'our_company',     // 本公司打印
  'partner_company', // 去友司打印
  'together',        // 一起打印
]);

// 打印标书安排表
export const bidPrintings = pgTable('bid_printings', {
  id: serial('id').primaryKey(),
  
  // 项目信息
  projectId: integer('project_id').references(() => projects.id), // 关联项目（可选）
  projectName: varchar('project_name', { length: 200 }).notNull(), // 项目名称
  projectCode: varchar('project_code', { length: 100 }), // 项目编号
  
  // 时间安排
  printingDeadline: timestamp('printing_deadline'), // 打印截止时间
  plannedDate: timestamp('planned_date'), // 计划打印日期
  actualDate: timestamp('actual_date'), // 实际完成日期
  
  // 打印方式
  printingMethod: printingMethodEnum('printing_method').notNull().default('our_company'), // 打印方式
  
  // 友司信息（去友司打印或一起打印时使用）
  partnerCompanyId: integer('partner_company_id').references(() => companies.id), // 友司公司
  partnerCompanyName: varchar('partner_company_name', { length: 200 }), // 友司公司名称
  partnerContactId: integer('partner_contact_id'), // 友司对接人
  partnerContactName: varchar('partner_contact_name', { length: 50 }), // 友司对接人姓名
  partnerContactPhone: varchar('partner_contact_phone', { length: 20 }), // 友司对接人电话
  
  // 打印详情
  copiesCount: integer('copies_count').default(1), // 打印份数
  paperSize: varchar('paper_size', { length: 20 }).default('A4'), // 纸张大小
  colorMode: varchar('color_mode', { length: 20 }).default('bw'), // 彩色/黑白: color/bw
  bindingMethod: varchar('binding_method', { length: 50 }), // 装订方式
  specialRequirements: text('special_requirements'), // 特殊要求
  
  // 我方负责人
  ourContactId: integer('our_contact_id').references(() => users.id), // 我方负责人
  ourContactName: varchar('our_contact_name', { length: 50 }), // 我方负责人姓名
  ourContactPhone: varchar('our_contact_phone', { length: 20 }), // 我方负责人电话
  
  // 任务指派
  assigneeId: integer('assignee_id').references(() => users.id), // 指派给谁
  assigneeName: varchar('assignee_name', { length: 50 }), // 指派人姓名（冗余）
  priority: varchar('priority', { length: 20 }).default('medium'), // 优先级: high/medium/low
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id), // 关联的任务ID
  pushedToTask: boolean('pushed_to_task').default(false), // 是否已推送到任务中心
  pushedAt: timestamp('pushed_at'), // 推送时间
  
  // 备注
  remarks: text('remarks'), // 备注说明
  
  // 状态
  status: bidPrintingStatusEnum('status').default('pending').notNull(), // 打印状态
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  // 完成时间
  completedAt: timestamp('completed_at'), // 完成时间
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('bid_printings_project_idx').on(table.projectId),
  statusIdx: index('bid_printings_status_idx').on(table.status),
  assigneeIdx: index('bid_printings_assignee_idx').on(table.assigneeId),
  taskIdx: index('bid_printings_task_idx').on(table.taskId),
  partnerIdx: index('bid_printings_partner_idx').on(table.partnerCompanyId),
}));

// ============================================
// 标书归档表
// ============================================

// 归档类型枚举
export const archiveTypeEnum = pgEnum('archive_type', [
  'auto',    // 自动归档
  'manual',  // 手动归档
]);

// 投标结果枚举
export const bidResultEnum = pgEnum('bid_result', [
  'awarded',  // 中标
  'lost',     // 未中标
  'pending',  // 待定
  'withdrawn', // 撤回
]);

// 归档状态枚举
export const archiveStatusEnum = pgEnum('archive_status', [
  'active',    // 正常
  'deleted',   // 已删除
]);

// 标书归档主表
export const bidArchives = pgTable('bid_archives', {
  id: serial('id').primaryKey(),
  
  // 公司信息
  companyId: integer('company_id').references(() => companies.id),
  companyName: varchar('company_name', { length: 200 }), // 冗余存储
  
  // 项目信息
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  projectName: varchar('project_name', { length: 200 }).notNull(), // 冗余存储
  projectCode: varchar('project_code', { length: 50 }), // 冗余存储
  tenderCode: varchar('tender_code', { length: 100 }), // 招标编号
  
  // 招标信息冗余
  tenderOrganization: varchar('tender_organization', { length: 200 }), // 招标单位
  tenderAgent: varchar('tender_agent', { length: 200 }), // 招标代理
  budget: varchar('budget', { length: 100 }), // 预算金额
  
  // 归档信息
  archiveType: archiveTypeEnum('archive_type').notNull().default('manual'),
  archiveDate: timestamp('archive_date').notNull().defaultNow(),
  bidResult: bidResultEnum('bid_result').default('pending'),
  archiveStatus: archiveStatusEnum('archive_status').notNull().default('active'),
  
  // 归档摘要
  summary: text('summary'), // 归档摘要
  notes: text('notes'), // 备注
  
  // 统计信息
  documentCount: integer('document_count').default(0), // 文档数量
  fileCount: integer('file_count').default(0), // 文件数量
  
  // 操作人
  archivedBy: integer('archived_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 归档文档表
export const bidArchiveDocuments = pgTable('bid_archive_documents', {
  id: serial('id').primaryKey(),
  archiveId: integer('archive_id').notNull().references(() => bidArchives.id, { onDelete: 'cascade' }),
  
  // 文档信息
  documentId: integer('document_id').references(() => bidDocuments.id, { onDelete: 'set null' }),
  documentName: varchar('document_name', { length: 200 }).notNull(),
  documentVersion: integer('document_version').default(1),
  documentStatus: varchar('document_status', { length: 50 }),
  
  // 存储信息
  documentPath: varchar('document_path', { length: 500 }), // 存储路径
  fileSize: integer('file_size'), // 文件大小(字节)
  fileType: varchar('file_type', { length: 50 }), // 文件类型
  
  // 章节信息
  chapterCount: integer('chapter_count').default(0),
  wordCount: integer('word_count').default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// 归档附件表
export const bidArchiveFiles = pgTable('bid_archive_files', {
  id: serial('id').primaryKey(),
  archiveId: integer('archive_id').notNull().references(() => bidArchives.id, { onDelete: 'cascade' }),
  
  // 文件信息
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSize: integer('file_size'), // 文件大小(字节)
  fileType: varchar('file_type', { length: 50 }), // 文件MIME类型
  
  // 分类
  category: varchar('category', { length: 50 }), // 分类：投标文件、答疑文件、其他
  description: text('description'), // 描述
  
  // 操作人
  uploadedBy: integer('uploaded_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 公司文件表
// ============================================

export const companyFiles = pgTable('company_files', {
  id: serial('id').primaryKey(),
  
  // 关联公司
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  
  // 文件信息
  fileName: varchar('file_name', { length: 255 }).notNull(), // 文件名称
  fileType: companyFileTypeEnum('file_type').notNull(), // 文件类型
  
  // 存储信息
  fileId: integer('file_id').references(() => files.id, { onDelete: 'set null' }), // 关联文件表
  fileUrl: varchar('file_url', { length: 500 }), // 文件存储URL
  fileSize: varchar('file_size', { length: 20 }), // 文件大小
  fileExt: varchar('file_ext', { length: 20 }), // 文件扩展名
  fileMd5: varchar('file_md5', { length: 64 }), // 文件MD5（防重复）
  
  // 有效期
  validFrom: timestamp('valid_from'), // 生效日期
  validTo: timestamp('valid_to'), // 失效日期
  expiryReminded: boolean('expiry_reminded').default(false), // 是否已提醒到期
  
  // 描述
  description: text('description'), // 文件描述
  
  // 上传者
  uploaderId: integer('uploader_id').notNull().references(() => users.id),
  
  // 状态
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  companyIdx: uniqueIndex('company_files_company_idx').on(table.companyId),
  typeIdx: uniqueIndex('company_files_type_idx').on(table.fileType),
  uploaderIdx: uniqueIndex('company_files_uploader_idx').on(table.uploaderId),
}));

// ============================================
// 公司资质到期提醒表
// ============================================

export const companyFileReminders = pgTable('company_file_reminders', {
  id: serial('id').primaryKey(),
  
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  companyFileId: integer('company_file_id').notNull().references(() => companyFiles.id, { onDelete: 'cascade' }),
  
  // 提醒配置
  reminderDays: integer('reminder_days').notNull().default(30), // 提前多少天提醒
  reminderType: varchar('reminder_type', { length: 20 }).notNull().default('email'), // email/system/wechat
  
  // 提醒状态
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/sent/acknowledged
  sentAt: timestamp('sent_at'),
  acknowledgedAt: timestamp('acknowledged_at'),
  
  // 接收人
  notifyUserId: integer('notify_user_id').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 公司文档框架表
// ============================================

// 公司文档框架主表
export const companyDocumentFrameworks = pgTable('company_document_frameworks', {
  id: serial('id').primaryKey(),
  
  // 关联公司
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  
  // 框架信息
  name: varchar('name', { length: 200 }).notNull(), // 框架名称
  description: text('description'), // 框架描述
  documentType: varchar('document_type', { length: 50 }).notNull(), // 文档类型（投标文件、技术方案等）
  
  // 框架来源
  sourceType: varchar('source_type', { length: 20 }).notNull().default('manual'), // manual/manual_upload/ai_generated
  sourceFileId: integer('source_file_id').references(() => files.id, { onDelete: 'set null' }), // 来源文件（如果是解析生成）
  
  // 框架配置
  isDefault: boolean('is_default').default(false), // 是否为公司默认框架
  isActive: boolean('is_active').default(true),
  
  // 创建者
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  companyIdx: index('company_framework_company_idx').on(table.companyId),
  documentTypeIdx: index('company_framework_doctype_idx').on(table.documentType),
  createdByIdx: index('company_framework_created_by_idx').on(table.createdBy),
}));

// 公司框架章节表（支持多级标题）
export const companyFrameworkChapters = pgTable('company_framework_chapters', {
  id: serial('id').primaryKey(),
  
  // 关联框架
  frameworkId: integer('framework_id').notNull().references(() => companyDocumentFrameworks.id, { onDelete: 'cascade' }),
  
  // 章节结构
  parentId: integer('parent_id'), // 父章节ID（支持多级）
  level: integer('level').notNull().default(1), // 层级（1为一级标题，2为二级标题，以此类推）
  order: integer('order').notNull().default(0), // 同级排序
  
  // 章节内容
  title: varchar('title', { length: 500 }).notNull(), // 章节标题
  titleNumber: varchar('title_number', { length: 50 }), // 章节编号（如 1.1、1.2.1）
  
  // 章节配置
  isRequired: boolean('is_required').default(true), // 是否必须包含
  description: text('description'), // 章节描述/说明
  
  // 内容模板
  contentTemplate: text('content_template'), // 内容模板（可用于指导填写）
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  frameworkIdx: index('company_chapter_framework_idx').on(table.frameworkId),
  parentIdx: index('company_chapter_parent_idx').on(table.parentId),
  levelIdx: index('company_chapter_level_idx').on(table.level),
}));

// ============================================
// 公司信息关系定义
// ============================================

export const companiesRelations = relations(companies, ({ one, many }) => ({
  creator: one(users, {
    fields: [companies.createdBy],
    references: [users.id],
  }),
  files: many(companyFiles),
  reminders: many(companyFileReminders),
  documentFrameworks: many(companyDocumentFrameworks),
  archives: many(bidArchives),
  contacts: many(companyContacts),
}));

export const companyContactsRelations = relations(companyContacts, ({ one }) => ({
  company: one(companies, {
    fields: [companyContacts.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [companyContacts.createdBy],
    references: [users.id],
  }),
}));

export const companyContactRolesRelations = relations(companyContactRoles, ({ one }) => ({
  creator: one(users, {
    fields: [companyContactRoles.createdBy],
    references: [users.id],
  }),
}));

export const companyFilesRelations = relations(companyFiles, ({ one }) => ({
  company: one(companies, {
    fields: [companyFiles.companyId],
    references: [companies.id],
  }),
  file: one(files, {
    fields: [companyFiles.fileId],
    references: [files.id],
  }),
  uploader: one(users, {
    fields: [companyFiles.uploaderId],
    references: [users.id],
  }),
}));

export const companyFileRemindersRelations = relations(companyFileReminders, ({ one }) => ({
  company: one(companies, {
    fields: [companyFileReminders.companyId],
    references: [companies.id],
  }),
  companyFile: one(companyFiles, {
    fields: [companyFileReminders.companyFileId],
    references: [companyFiles.id],
  }),
  notifyUser: one(users, {
    fields: [companyFileReminders.notifyUserId],
    references: [users.id],
  }),
}));

// ============================================
// 标书归档关系定义
// ============================================

export const bidArchivesRelations = relations(bidArchives, ({ one, many }) => ({
  company: one(companies, {
    fields: [bidArchives.companyId],
    references: [companies.id],
  }),
  project: one(projects, {
    fields: [bidArchives.projectId],
    references: [projects.id],
  }),
  archiver: one(users, {
    fields: [bidArchives.archivedBy],
    references: [users.id],
  }),
  documents: many(bidArchiveDocuments),
  files: many(bidArchiveFiles),
}));

export const bidArchiveDocumentsRelations = relations(bidArchiveDocuments, ({ one }) => ({
  archive: one(bidArchives, {
    fields: [bidArchiveDocuments.archiveId],
    references: [bidArchives.id],
  }),
  document: one(bidDocuments, {
    fields: [bidArchiveDocuments.documentId],
    references: [bidDocuments.id],
  }),
}));

export const bidArchiveFilesRelations = relations(bidArchiveFiles, ({ one }) => ({
  archive: one(bidArchives, {
    fields: [bidArchiveFiles.archiveId],
    references: [bidArchives.id],
  }),
  uploader: one(users, {
    fields: [bidArchiveFiles.uploadedBy],
    references: [users.id],
  }),
}));

// 公司文档框架关系
export const companyDocumentFrameworksRelations = relations(companyDocumentFrameworks, ({ one, many }) => ({
  company: one(companies, {
    fields: [companyDocumentFrameworks.companyId],
    references: [companies.id],
  }),
  sourceFile: one(files, {
    fields: [companyDocumentFrameworks.sourceFileId],
    references: [files.id],
  }),
  creator: one(users, {
    fields: [companyDocumentFrameworks.createdBy],
    references: [users.id],
  }),
  chapters: many(companyFrameworkChapters),
}));

export const companyFrameworkChaptersRelations = relations(companyFrameworkChapters, ({ one, many }) => ({
  framework: one(companyDocumentFrameworks, {
    fields: [companyFrameworkChapters.frameworkId],
    references: [companyDocumentFrameworks.id],
  }),
  parent: one(companyFrameworkChapters, {
    fields: [companyFrameworkChapters.parentId],
    references: [companyFrameworkChapters.id],
    relationName: 'chapter_hierarchy',
  }),
  children: many(companyFrameworkChapters, {
    relationName: 'chapter_hierarchy',
  }),
}));

// ============================================
// 公司信息类型导出
// ============================================

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type CompanyFile = typeof companyFiles.$inferSelect;
export type NewCompanyFile = typeof companyFiles.$inferInsert;
export type CompanyFileReminder = typeof companyFileReminders.$inferSelect;
export type NewCompanyFileReminder = typeof companyFileReminders.$inferInsert;
export type CompanyFileType = typeof companyFileTypeEnum.enumValues[number];
export type CompanyDocumentFramework = typeof companyDocumentFrameworks.$inferSelect;
export type NewCompanyDocumentFramework = typeof companyDocumentFrameworks.$inferInsert;
export type CompanyFrameworkChapter = typeof companyFrameworkChapters.$inferSelect;
export type NewCompanyFrameworkChapter = typeof companyFrameworkChapters.$inferInsert;

// 公司对接人类型导出
export type CompanyContact = typeof companyContacts.$inferSelect;
export type NewCompanyContact = typeof companyContacts.$inferInsert;
export type CompanyContactRole = typeof companyContactRoles.$inferSelect;
export type NewCompanyContactRole = typeof companyContactRoles.$inferInsert;
export type ContactRoleType = typeof contactRoleTypeEnum.enumValues[number];

// 购买招标文件安排关系定义
export const bidDocumentPurchasesRelations = relations(bidDocumentPurchases, ({ one }) => ({
  project: one(projects, {
    fields: [bidDocumentPurchases.projectId],
    references: [projects.id],
  }),
  ourContact: one(users, {
    fields: [bidDocumentPurchases.ourContactId],
    references: [users.id],
  }),
  partnerCompany: one(companies, {
    fields: [bidDocumentPurchases.partnerCompanyId],
    references: [companies.id],
  }),
  assignee: one(users, {
    fields: [bidDocumentPurchases.assigneeId],
    references: [users.id],
  }),
  task: one(projectTasks, {
    fields: [bidDocumentPurchases.taskId],
    references: [projectTasks.id],
  }),
  creator: one(users, {
    fields: [bidDocumentPurchases.createdBy],
    references: [users.id],
  }),
}));

// 购买招标文件安排类型导出
export type BidDocumentPurchase = typeof bidDocumentPurchases.$inferSelect;
export type NewBidDocumentPurchase = typeof bidDocumentPurchases.$inferInsert;
export type BidDocPurchaseStatus = typeof bidDocPurchaseStatusEnum.enumValues[number];

// ============================================
// 打印标书关系定义
// ============================================

export const bidPrintingsRelations = relations(bidPrintings, ({ one }) => ({
  project: one(projects, {
    fields: [bidPrintings.projectId],
    references: [projects.id],
  }),
  ourContact: one(users, {
    fields: [bidPrintings.ourContactId],
    references: [users.id],
  }),
  partnerCompany: one(companies, {
    fields: [bidPrintings.partnerCompanyId],
    references: [companies.id],
  }),
  assignee: one(users, {
    fields: [bidPrintings.assigneeId],
    references: [users.id],
  }),
  task: one(projectTasks, {
    fields: [bidPrintings.taskId],
    references: [projectTasks.id],
  }),
  creator: one(users, {
    fields: [bidPrintings.createdBy],
    references: [users.id],
  }),
}));

// 打印标书安排类型导出
export type BidPrinting = typeof bidPrintings.$inferSelect;
export type NewBidPrinting = typeof bidPrintings.$inferInsert;
export type BidPrintingStatus = typeof bidPrintingStatusEnum.enumValues[number];

// ============================================
// 盖章申请表
// ============================================

// 盖章方式枚举
export const sealMethodEnum = pgEnum('seal_method', [
  'our_company',      // 本公司盖章（我们带公章去对方公司）
  'partner_company',  // 对方来我们公司盖章
]);

// 盖章状态枚举（盖章申请专用）
export const bidSealStatusEnum = pgEnum('bid_seal_status', [
  'pending',      // 待盖章
  'in_progress',  // 进行中
  'completed',    // 已完成
  'cancelled',    // 已取消
]);

export const bidSealApplications = pgTable('bid_seal_applications', {
  id: serial('id').primaryKey(),
  
  // 项目信息
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  projectName: varchar('project_name', { length: 200 }).notNull(),
  projectCode: varchar('project_code', { length: 50 }),
  
  // 盖章截止时间
  sealDeadline: timestamp('seal_deadline'),
  
  // 计划日期和实际完成日期
  plannedDate: timestamp('planned_date'),
  actualDate: timestamp('actual_date'),
  
  // 盖章方式
  sealMethod: sealMethodEnum('seal_method').notNull().default('our_company'),
  
  // 友司信息
  partnerCompanyId: integer('partner_company_id').references(() => companies.id), // 友司公司
  partnerCompanyName: varchar('partner_company_name', { length: 200 }),
  partnerCompanyAddress: varchar('partner_company_address', { length: 500 }), // 友司地址（从公司管理获取）
  partnerContactId: integer('partner_contact_id').references(() => companyContacts.id), // 友司对接人
  partnerContactName: varchar('partner_contact_name', { length: 50 }),
  partnerContactPhone: varchar('partner_contact_phone', { length: 20 }),
  
  // 盖章详情
  sealCount: integer('seal_count').notNull().default(1), // 盖章份数
  sealPurpose: varchar('seal_purpose', { length: 200 }), // 盖章用途
  documentType: varchar('document_type', { length: 100 }), // 文件类型
  specialRequirements: text('special_requirements'), // 特殊要求
  
  // 本方对接人
  ourContactId: integer('our_contact_id').references(() => users.id),
  ourContactName: varchar('our_contact_name', { length: 50 }),
  ourContactPhone: varchar('our_contact_phone', { length: 20 }),
  
  // 任务指派
  assigneeId: integer('assignee_id').references(() => users.id),
  assigneeName: varchar('assignee_name', { length: 50 }),
  
  // 优先级
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  
  // 备注
  remarks: text('remarks'),
  
  // 状态
  status: bidSealStatusEnum('status').notNull().default('pending'),
  completedAt: timestamp('completed_at'),
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const bidSealApplicationsRelations = relations(bidSealApplications, ({ one }) => ({
  project: one(projects, {
    fields: [bidSealApplications.projectId],
    references: [projects.id],
  }),
  ourContact: one(users, {
    fields: [bidSealApplications.ourContactId],
    references: [users.id],
  }),
  partnerCompany: one(companies, {
    fields: [bidSealApplications.partnerCompanyId],
    references: [companies.id],
  }),
  partnerContact: one(companyContacts, {
    fields: [bidSealApplications.partnerContactId],
    references: [companyContacts.id],
  }),
  assignee: one(users, {
    fields: [bidSealApplications.assigneeId],
    references: [users.id],
  }),
  task: one(projectTasks, {
    fields: [bidSealApplications.taskId],
    references: [projectTasks.id],
  }),
  creator: one(users, {
    fields: [bidSealApplications.createdBy],
    references: [users.id],
  }),
}));

// 盖章申请类型导出
export type BidSealApplication = typeof bidSealApplications.$inferSelect;
export type NewBidSealApplication = typeof bidSealApplications.$inferInsert;
export type SealMethod = typeof sealMethodEnum.enumValues[number];
export type BidSealStatus = typeof bidSealStatusEnum.enumValues[number];

// ============================================
// 招标文件解读模块
// ============================================

// 解读状态枚举
export const interpretationStatusEnum = pgEnum('interpretation_status', [
  'pending',     // 待解析
  'parsing',     // 解析中
  'completed',   // 已完成
  'failed',      // 解析失败
]);

// 文件类型枚举
export const documentExtEnum = pgEnum('document_ext', [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
]);

// 解读标签类型枚举
export const interpretationTagTypeEnum = pgEnum('interpretation_tag_type', [
  'priority',    // 优先级标签
  'status',      // 状态标签
  'category',    // 分类标签
  'custom',      // 自定义标签
]);

// ============================================
// 招标文件解读主表
// ============================================

export const bidDocumentInterpretations = pgTable('bid_document_interpretations', {
  id: serial('id').primaryKey(),
  
  // 文件信息
  documentName: varchar('document_name', { length: 128 }).notNull(), // 招标文件名称
  documentUrl: varchar('document_url', { length: 500 }).notNull(), // 文件存储URL
  documentExt: documentExtEnum('document_ext').notNull(), // 文件格式
  documentSize: integer('document_size'), // 文件大小（字节）
  documentMd5: varchar('document_md5', { length: 64 }).notNull(), // 文件MD5（防重复）
  documentPageCount: integer('document_page_count'), // 文件页数
  
  // 项目信息（提取）
  projectName: varchar('project_name', { length: 200 }), // 项目名称
  projectCode: varchar('project_code', { length: 100 }), // 项目编号
  tenderOrganization: varchar('tender_organization', { length: 200 }), // 招标单位
  tenderAgent: varchar('tender_agent', { length: 200 }), // 招标代理机构
  projectBudget: varchar('project_budget', { length: 100 }), // 项目预算
  
  // 政采单位关联（数据联动核心）
  platformId: integer('platform_id'), // 招标单位ID（关联政采单位）
  agentPlatformId: integer('agent_platform_id'), // 招标代理机构ID（关联政采单位）
  
  // 解析状态
  status: interpretationStatusEnum('status').notNull().default('pending'), // 解析状态
  parseProgress: integer('parse_progress').default(0), // 解析进度
  parseError: text('parse_error'), // 解析错误信息
  extractAccuracy: integer('extract_accuracy'), // 提取精度（百分比）
  
  // 时间节点（提取）
  submissionDeadline: timestamp('submission_deadline'), // 投标截止时间
  openBidTime: timestamp('open_bid_time'), // 开标时间
  openBidLocation: varchar('open_bid_location', { length: 500 }), // 开标地点
  questionDeadline: timestamp('question_deadline'), // 答疑截止时间
  answerTime: timestamp('answer_time'), // 答疑回复时间
  
  // 提取的结构化数据（JSON）
  basicInfo: text('basic_info'), // 项目基础信息
  timeNodes: text('time_nodes'), // 时间节点信息
  submissionRequirements: text('submission_requirements'), // 投标提交要求
  feeInfo: text('fee_info'), // 费用相关信息
  qualificationRequirements: text('qualification_requirements'), // 资质要求
  personnelRequirements: text('personnel_requirements'), // 人员要求
  docRequirements: text('doc_requirements'), // 投标文档要求
  otherRequirements: text('other_requirements'), // 其他关键要求
  
  // 统计信息
  specCount: integer('spec_count').default(0), // 技术规格项数
  scoringCount: integer('scoring_count').default(0), // 评分细则项数
  checklistCount: integer('checklist_count').default(0), // 核对清单项数
  
  // 标签（JSON数组）
  tags: text('tags'), // 记录标签
  
  // 过期设置
  expireTime: timestamp('expire_time'), // 记录过期时间
  
  // 解析耗时
  parseDuration: integer('parse_duration'), // 解析耗时（毫秒）
  
  // 上传者
  uploaderId: integer('uploader_id').notNull().references(() => users.id),
  
  // 关联项目（可选）
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  documentMd5Idx: uniqueIndex('bid_interpret_doc_md5_idx').on(table.documentMd5),
  statusIdx: uniqueIndex('bid_interpret_status_idx').on(table.status),
  uploaderIdx: uniqueIndex('bid_interpret_uploader_idx').on(table.uploaderId),
  projectIdx: uniqueIndex('bid_interpret_project_idx').on(table.projectId),
  createdAtIdx: uniqueIndex('bid_interpret_created_at_idx').on(table.createdAt),
}));

// ============================================
// 技术规格表
// ============================================

export const bidTechnicalSpecs = pgTable('bid_technical_specs', {
  id: serial('id').primaryKey(),
  interpretationId: integer('interpretation_id').notNull().references(() => bidDocumentInterpretations.id, { onDelete: 'cascade' }),
  
  // 分类信息
  specCategory: varchar('spec_category', { length: 64 }).notNull(), // 规格分类
  specSubCategory: varchar('spec_sub_category', { length: 64 }), // 规格子分类
  
  // 规格内容
  specName: varchar('spec_name', { length: 200 }).notNull(), // 规格名称
  specValue: text('spec_value'), // 规格值
  specUnit: varchar('spec_unit', { length: 32 }), // 单位
  specRequirement: text('spec_requirement'), // 要求描述
  
  // 参数范围
  minValue: varchar('min_value', { length: 100 }), // 最小值
  maxValue: varchar('max_value', { length: 100 }), // 最大值
  allowableDeviation: varchar('allowable_deviation', { length: 100 }), // 允许偏差
  
  // 关键标识
  isKeyParam: boolean('is_key_param').default(false), // 是否关键参数
  isMandatory: boolean('is_mandatory').default(true), // 是否必须满足
  
  // 响应信息
  responseValue: text('response_value'), // 响应值
  responseStatus: varchar('response_status', { length: 20 }).default('pending'), // pending/compliant/non_compliant/partial
  
  // 原文位置
  originalText: text('original_text'), // 原文引用
  pageNumber: integer('page_number'), // 页码
  
  // 备注
  remarks: text('remarks'),
  
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  interpretationIdx: uniqueIndex('bid_tech_spec_interpretation_idx').on(table.interpretationId),
  categoryIdx: uniqueIndex('bid_tech_spec_category_idx').on(table.specCategory),
}));

// ============================================
// 评分细则表
// ============================================

export const bidScoringItems = pgTable('bid_scoring_items', {
  id: serial('id').primaryKey(),
  interpretationId: integer('interpretation_id').notNull().references(() => bidDocumentInterpretations.id, { onDelete: 'cascade' }),
  
  // 分类信息
  scoringCategory: varchar('scoring_category', { length: 64 }).notNull(), // 评分分类（商务/技术/报价）
  scoringSubCategory: varchar('scoring_sub_category', { length: 64 }), // 评分子分类
  
  // 评分项信息
  itemName: varchar('item_name', { length: 200 }).notNull(), // 评分项名称
  itemDescription: text('item_description'), // 评分项描述
  serialNumber: varchar('serial_number', { length: 50 }), // 序号
  
  // 分值
  maxScore: integer('max_score').notNull(), // 满分分值
  minScore: integer('min_score').default(0), // 最低分值
  
  // 评分标准
  scoringMethod: varchar('scoring_method', { length: 100 }), // 评分方法
  scoringCriteria: text('scoring_criteria'), // 评分标准详情
  
  // 扣分规则
  deductionRules: text('deduction_rules'), // 扣分情形（JSON数组）
  deductionScore: integer('deduction_score'), // 扣分分值
  
  // 加分项
  bonusRules: text('bonus_rules'), // 加分情形（JSON数组）
  bonusScore: integer('bonus_score'), // 加分分值
  
  // 响应信息
  selfScore: integer('self_score'), // 自评分数
  responseContent: text('response_content'), // 响应内容
  responseStatus: varchar('response_status', { length: 20 }).default('pending'), // pending/responded/reviewed
  
  // 原文位置
  originalText: text('original_text'), // 原文引用
  pageNumber: integer('page_number'), // 页码
  
  // 备注
  remarks: text('remarks'),
  
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  interpretationIdx: uniqueIndex('bid_scoring_item_interpretation_idx').on(table.interpretationId),
  categoryIdx: uniqueIndex('bid_scoring_item_category_idx').on(table.scoringCategory),
}));

// ============================================
// 资质要求核对清单表
// ============================================

export const bidRequirementChecklist = pgTable('bid_requirement_checklist', {
  id: serial('id').primaryKey(),
  interpretationId: integer('interpretation_id').notNull().references(() => bidDocumentInterpretations.id, { onDelete: 'cascade' }),
  
  // 分类信息
  checklistCategory: varchar('checklist_category', { length: 64 }).notNull(), // 分类（资质/人员/业绩/其他）
  checklistSubCategory: varchar('checklist_sub_category', { length: 64 }), // 子分类
  
  // 核对项信息
  itemName: varchar('item_name', { length: 200 }).notNull(), // 核对项名称
  itemDescription: text('item_description'), // 核对项描述
  serialNumber: varchar('serial_number', { length: 50 }), // 序号
  
  // 要求详情
  requirementDetail: text('requirement_detail'), // 要求详情
  requiredValue: text('required_value'), // 要求值
  requiredDocuments: text('required_documents'), // 所需证明材料（JSON数组）
  
  // 是否必须
  isMandatory: boolean('is_mandatory').default(true), // 是否必须满足
  
  // 核对结果
  checkStatus: varchar('check_status', { length: 20 }).default('pending'), // pending/compliant/non_compliant/partial
  actualValue: text('actual_value'), // 实际值
  checkedBy: integer('checked_by').references(() => users.id), // 核对人
  checkedAt: timestamp('checked_at'), // 核对时间
  
  // 证明材料
  proofDocuments: text('proof_documents'), // 已上传证明材料（JSON数组）
  
  // 改进建议
  improvementSuggestion: text('improvement_suggestion'), // 改进建议
  
  // 原文位置
  originalText: text('original_text'), // 原文引用
  pageNumber: integer('page_number'), // 页码
  
  // 备注
  remarks: text('remarks'),
  
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  interpretationIdx: uniqueIndex('bid_checklist_interpretation_idx').on(table.interpretationId),
  categoryIdx: uniqueIndex('bid_checklist_category_idx').on(table.checklistCategory),
}));

// ============================================
// 文档框架表
// ============================================

export const bidDocumentFramework = pgTable('bid_document_framework', {
  id: serial('id').primaryKey(),
  interpretationId: integer('interpretation_id').notNull().references(() => bidDocumentInterpretations.id, { onDelete: 'cascade' }),
  
  // 章节信息
  chapterNumber: varchar('chapter_number', { length: 50 }), // 章节编号
  chapterTitle: varchar('chapter_title', { length: 300 }).notNull(), // 章节标题
  chapterType: varchar('chapter_type', { length: 50 }), // 章节类型（商务/技术/资质/报价等）
  
  // 层级
  parentId: integer('parent_id'), // 父章节ID
  level: integer('level').notNull().default(1), // 层级
  
  // 内容要求
  contentRequirement: text('content_requirement'), // 内容要求
  formatRequirement: text('format_requirement'), // 格式要求
  pageLimit: integer('page_limit'), // 页数限制
  
  // 关联信息
  relatedScoringIds: text('related_scoring_ids'), // 关联评分项ID（JSON数组）
  
  // 原文位置
  originalText: text('original_text'), // 原文引用
  pageNumber: integer('page_number'), // 页码
  
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  interpretationIdx: uniqueIndex('bid_framework_interpretation_idx').on(table.interpretationId),
  parentIdx: uniqueIndex('bid_framework_parent_idx').on(table.parentId),
}));

// ============================================
// 解读日志表
// ============================================

export const bidInterpretationLogs = pgTable('bid_interpretation_logs', {
  id: serial('id').primaryKey(),
  interpretationId: integer('interpretation_id').notNull().references(() => bidDocumentInterpretations.id, { onDelete: 'cascade' }),
  
  // 操作信息
  operationType: varchar('operation_type', { length: 32 }).notNull(), // 操作类型
  operationContent: text('operation_content'), // 操作内容
  operationTime: timestamp('operation_time').defaultNow().notNull(), // 操作时间
  operationIp: varchar('operation_ip', { length: 64 }), // 操作IP
  
  // 操作人
  operatorId: integer('operator_id').references(() => users.id), // 操作人ID
  operatorName: varchar('operator_name', { length: 50 }), // 操作人姓名
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  interpretationIdx: uniqueIndex('bid_interpret_log_interpretation_idx').on(table.interpretationId),
  operatorIdx: uniqueIndex('bid_interpret_log_operator_idx').on(table.operatorId),
  timeIdx: uniqueIndex('bid_interpret_log_time_idx').on(table.operationTime),
}));

// ============================================
// 时间节点提醒表
// ============================================

export const bidTimeReminders = pgTable('bid_time_reminders', {
  id: serial('id').primaryKey(),
  interpretationId: integer('interpretation_id').notNull().references(() => bidDocumentInterpretations.id, { onDelete: 'cascade' }),
  
  // 提醒配置
  reminderType: varchar('reminder_type', { length: 64 }).notNull(), // 提醒类型（投标截止/开标时间等）
  reminderTime: timestamp('reminder_time').notNull(), // 提醒时间
  targetTime: timestamp('target_time').notNull(), // 目标时间
  reminderDays: integer('reminder_days').default(3), // 提前天数
  
  // 提醒状态
  isReminded: boolean('is_reminded').default(false), // 是否已提醒
  remindedAt: timestamp('reminded_at'), // 提醒时间
  
  // 提醒方式
  reminderMethod: varchar('reminder_method', { length: 32 }).default('system'), // system/email/sms
  
  // 提醒内容
  reminderContent: text('reminder_content'), // 提醒内容
  
  // 接收人
  userId: integer('user_id').references(() => users.id), // 接收用户ID
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  interpretationIdx: uniqueIndex('bid_time_reminder_interpretation_idx').on(table.interpretationId),
  userIdx: uniqueIndex('bid_time_reminder_user_idx').on(table.userId),
  targetTimeIdx: uniqueIndex('bid_time_reminder_target_time_idx').on(table.targetTime),
  isRemindedIdx: uniqueIndex('bid_time_reminder_is_reminded_idx').on(table.isReminded),
}));

// ============================================
// 招标文件解读关系定义
// ============================================

export const bidDocumentInterpretationsRelations = relations(bidDocumentInterpretations, ({ one, many }) => ({
  uploader: one(users, {
    fields: [bidDocumentInterpretations.uploaderId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [bidDocumentInterpretations.projectId],
    references: [projects.id],
  }),
  technicalSpecs: many(bidTechnicalSpecs),
  scoringItems: many(bidScoringItems),
  checklist: many(bidRequirementChecklist),
  framework: many(bidDocumentFramework),
  logs: many(bidInterpretationLogs),
  reminders: many(bidTimeReminders),
}));

export const bidTechnicalSpecsRelations = relations(bidTechnicalSpecs, ({ one }) => ({
  interpretation: one(bidDocumentInterpretations, {
    fields: [bidTechnicalSpecs.interpretationId],
    references: [bidDocumentInterpretations.id],
  }),
}));

export const bidScoringItemsRelations = relations(bidScoringItems, ({ one }) => ({
  interpretation: one(bidDocumentInterpretations, {
    fields: [bidScoringItems.interpretationId],
    references: [bidDocumentInterpretations.id],
  }),
}));

export const bidRequirementChecklistRelations = relations(bidRequirementChecklist, ({ one }) => ({
  interpretation: one(bidDocumentInterpretations, {
    fields: [bidRequirementChecklist.interpretationId],
    references: [bidDocumentInterpretations.id],
  }),
  checker: one(users, {
    fields: [bidRequirementChecklist.checkedBy],
    references: [users.id],
  }),
}));

export const bidDocumentFrameworkRelations = relations(bidDocumentFramework, ({ one, many }) => ({
  interpretation: one(bidDocumentInterpretations, {
    fields: [bidDocumentFramework.interpretationId],
    references: [bidDocumentInterpretations.id],
  }),
  parent: one(bidDocumentFramework, {
    fields: [bidDocumentFramework.parentId],
    references: [bidDocumentFramework.id],
    relationName: 'framework_hierarchy',
  }),
  children: many(bidDocumentFramework, { relationName: 'framework_hierarchy' }),
}));

export const bidInterpretationLogsRelations = relations(bidInterpretationLogs, ({ one }) => ({
  interpretation: one(bidDocumentInterpretations, {
    fields: [bidInterpretationLogs.interpretationId],
    references: [bidDocumentInterpretations.id],
  }),
  operator: one(users, {
    fields: [bidInterpretationLogs.operatorId],
    references: [users.id],
  }),
}));

export const bidTimeRemindersRelations = relations(bidTimeReminders, ({ one }) => ({
  interpretation: one(bidDocumentInterpretations, {
    fields: [bidTimeReminders.interpretationId],
    references: [bidDocumentInterpretations.id],
  }),
  user: one(users, {
    fields: [bidTimeReminders.userId],
    references: [users.id],
  }),
}));

// ============================================
// 招标文件解读类型导出
// ============================================

export type BidDocumentInterpretation = typeof bidDocumentInterpretations.$inferSelect;
export type NewBidDocumentInterpretation = typeof bidDocumentInterpretations.$inferInsert;
export type BidTechnicalSpec = typeof bidTechnicalSpecs.$inferSelect;
export type NewBidTechnicalSpec = typeof bidTechnicalSpecs.$inferInsert;
export type BidScoringItem = typeof bidScoringItems.$inferSelect;
export type NewBidScoringItem = typeof bidScoringItems.$inferInsert;
export type BidRequirementChecklistItem = typeof bidRequirementChecklist.$inferSelect;
export type NewBidRequirementChecklistItem = typeof bidRequirementChecklist.$inferInsert;
export type BidDocumentFrameworkItem = typeof bidDocumentFramework.$inferSelect;
export type NewBidDocumentFrameworkItem = typeof bidDocumentFramework.$inferInsert;
export type BidInterpretationLog = typeof bidInterpretationLogs.$inferSelect;
export type NewBidInterpretationLog = typeof bidInterpretationLogs.$inferInsert;
export type BidTimeReminder = typeof bidTimeReminders.$inferSelect;
export type NewBidTimeReminder = typeof bidTimeReminders.$inferInsert;
export type InterpretationStatus = typeof interpretationStatusEnum.enumValues[number];
export type DocumentExt = typeof documentExtEnum.enumValues[number];

// ============================================
// 回收站模块
// ============================================

// 资源类型枚举
export const recycleResourceTypeEnum = pgEnum('recycle_resource_type', [
  'document',      // 标书文档
  'chapter',       // 章节内容
  'file',          // 文件
  'company',       // 公司
  'company_file',  // 公司文件
  'project',       // 项目
]);

// 提醒类型枚举
export const deletionReminderTypeEnum = pgEnum('deletion_reminder_type', [
  'seven_days',    // 7天前提醒
  'one_day',       // 1天前提醒
]);

// 回收站表
export const recycleBin = pgTable('recycle_bin', {
  id: serial('id').primaryKey(),
  
  // 资源信息
  resourceType: recycleResourceTypeEnum('resource_type').notNull(),
  resourceId: integer('resource_id').notNull(), // 原始资源ID
  
  // 资源快照（存储原始数据的JSON）
  resourceName: varchar('resource_name', { length: 500 }).notNull(), // 资源名称（用于显示）
  resourceData: text('resource_data').notNull(), // 原始资源数据的JSON快照
  
  // 关联信息（便于查询和恢复）
  projectId: integer('project_id'), // 关联项目ID（如果适用）
  companyId: integer('company_id'), // 关联公司ID（如果适用）
  
  // 删除信息
  deletedBy: integer('deleted_by').notNull().references(() => users.id),
  deletedAt: timestamp('deleted_at').notNull().defaultNow(),
  deleteReason: text('delete_reason'), // 删除原因
  
  // 过期信息
  expiresAt: timestamp('expires_at').notNull(), // 自动删除时间（30天后）
  
  // 提醒状态
  sevenDayReminderSent: boolean('seven_day_reminder_sent').default(false), // 7天前提醒是否已发送
  oneDayReminderSent: boolean('one_day_reminder_sent').default(false), // 1天前提醒是否已发送
  
  // 恢复信息
  restoredAt: timestamp('restored_at'),
  restoredBy: integer('restored_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  resourceTypeIdx: uniqueIndex('recycle_bin_resource_type_idx').on(table.resourceType),
  resourceIdIdx: uniqueIndex('recycle_bin_resource_id_idx').on(table.resourceId),
  deletedByIdx: uniqueIndex('recycle_bin_deleted_by_idx').on(table.deletedBy),
  expiresAtIdx: uniqueIndex('recycle_bin_expires_at_idx').on(table.expiresAt),
}));

// 删除提醒记录表
export const deletionReminders = pgTable('deletion_reminders', {
  id: serial('id').primaryKey(),
  
  recycleBinId: integer('recycle_bin_id').notNull().references(() => recycleBin.id, { onDelete: 'cascade' }),
  
  // 提醒信息
  reminderType: deletionReminderTypeEnum('reminder_type').notNull(),
  scheduledAt: timestamp('scheduled_at').notNull(), // 计划发送时间
  
  // 发送状态
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending/sent/failed
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  
  // 接收人
  notifyUserId: integer('notify_user_id').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  recycleBinIdx: uniqueIndex('deletion_reminders_recycle_bin_idx').on(table.recycleBinId),
  statusIdx: uniqueIndex('deletion_reminders_status_idx').on(table.status),
  scheduledAtIdx: uniqueIndex('deletion_reminders_scheduled_at_idx').on(table.scheduledAt),
}));

// ============================================
// 回收站关系定义
// ============================================

export const recycleBinRelations = relations(recycleBin, ({ one, many }) => ({
  deleter: one(users, {
    fields: [recycleBin.deletedBy],
    references: [users.id],
  }),
  restorer: one(users, {
    fields: [recycleBin.restoredBy],
    references: [users.id],
  }),
  reminders: many(deletionReminders),
}));

export const deletionRemindersRelations = relations(deletionReminders, ({ one }) => ({
  recycleBinItem: one(recycleBin, {
    fields: [deletionReminders.recycleBinId],
    references: [recycleBin.id],
  }),
  notifyUser: one(users, {
    fields: [deletionReminders.notifyUserId],
    references: [users.id],
  }),
}));

// ============================================
// 回收站类型导出
// ============================================

export type RecycleBinItem = typeof recycleBin.$inferSelect;
export type NewRecycleBinItem = typeof recycleBin.$inferInsert;
export type DeletionReminder = typeof deletionReminders.$inferSelect;
export type NewDeletionReminder = typeof deletionReminders.$inferInsert;
export type RecycleResourceType = typeof recycleResourceTypeEnum.enumValues[number];
export type DeletionReminderType = typeof deletionReminderTypeEnum.enumValues[number];

// ============================================
// 工作流引擎模块
// ============================================

// 工作流状态枚举
export const workflowStatusEnum = pgEnum('workflow_status', [
  'draft',      // 草稿
  'active',     // 启用
  'inactive',   // 停用
]);

// 工作流实例状态枚举
export const workflowInstanceStatusEnum = pgEnum('workflow_instance_status', [
  'pending',    // 待启动
  'running',    // 运行中
  'completed',  // 已完成
  'cancelled',  // 已取消
  'rejected',   // 已拒绝
]);

// 节点类型枚举
export const workflowNodeTypeEnum = pgEnum('workflow_node_type', [
  'start',        // 开始节点
  'end',          // 结束节点
  'approval',     // 审批节点
  'parallel',     // 并行节点
  'condition',    // 条件节点
  'notify',       // 通知节点
  'auto',         // 自动节点
]);

// 任务状态枚举
export const workflowTaskStatusEnum = pgEnum('workflow_task_status', [
  'pending',     // 待处理
  'completed',   // 已完成
  'rejected',    // 已拒绝
  'cancelled',   // 已取消
  'transferred', // 已转办
]);

// 分配类型枚举
export const workflowAssigneeTypeEnum = pgEnum('workflow_assignee_type', [
  'user',        // 指定用户
  'role',        // 指定角色
  'department',  // 指定部门
  'manager',     // 部门主管
  'creator',     // 创建人
  'previous',    // 上一节点处理人
  'expression',  // 表达式
]);

// 工作流定义表
export const workflowDefinitions = pgTable('workflow_definitions', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(), // 工作流编码
  description: text('description'),
  
  // 分类
  category: varchar('category', { length: 50 }), // 分类：approval/review/publish等
  businessType: varchar('business_type', { length: 50 }), // 业务类型：document/project等
  
  // 配置
  config: text('config'), // JSON配置（表单字段、变量等）
  
  // 状态
  status: workflowStatusEnum('status').notNull().default('draft'),
  version: integer('version').notNull().default(1),
  
  // 统计
  instanceCount: integer('instance_count').notNull().default(0), // 实例数量
  
  // 创建信息
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: uniqueIndex('workflow_definitions_code_idx').on(table.code),
  categoryIdx: uniqueIndex('workflow_definitions_category_idx').on(table.category),
  statusIdx: uniqueIndex('workflow_definitions_status_idx').on(table.status),
}));

// 工作流节点表
export const workflowNodes = pgTable('workflow_nodes', {
  id: serial('id').primaryKey(),
  
  // 关联定义
  definitionId: integer('definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
  
  // 节点信息
  nodeKey: varchar('node_key', { length: 50 }).notNull(), // 节点标识
  name: varchar('name', { length: 100 }).notNull(),
  type: workflowNodeTypeEnum('type').notNull(),
  
  // 节点配置
  config: text('config'), // JSON配置
  
  // 审批配置
  assigneeType: workflowAssigneeTypeEnum('assignee_type'),
  assigneeValue: varchar('assignee_value', { length: 500 }), // 用户ID/角色ID/部门ID/表达式
  multiApproveType: varchar('multi_approve_type', { length: 20 }), // or/and/percent
  approvePercent: integer('approve_percent'), // 通过百分比
  
  // 超时配置
  timeoutHours: integer('timeout_hours'),
  timeoutAction: varchar('timeout_action', { length: 20 }), // auto_approve/auto_reject/notify
  
  // 通知配置
  notifyConfig: text('notify_config'), // JSON配置
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  // 坐标（流程图）
  positionX: integer('position_x'),
  positionY: integer('position_y'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  definitionIdx: uniqueIndex('workflow_nodes_definition_idx').on(table.definitionId),
  nodeKeyIdx: uniqueIndex('workflow_nodes_node_key_idx').on(table.definitionId, table.nodeKey),
}));

// 工作流转换表（节点间连线）
export const workflowTransitions = pgTable('workflow_transitions', {
  id: serial('id').primaryKey(),
  
  // 关联定义
  definitionId: integer('definition_id').notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
  
  // 源节点和目标节点
  sourceNodeId: integer('source_node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
  targetNodeId: integer('target_node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
  
  // 条件配置
  condition: text('condition'), // JSON条件表达式
  conditionType: varchar('condition_type', { length: 20 }), // expression/script
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  definitionIdx: uniqueIndex('workflow_transitions_definition_idx').on(table.definitionId),
  sourceIdx: uniqueIndex('workflow_transitions_source_idx').on(table.sourceNodeId),
  targetIdx: uniqueIndex('workflow_transitions_target_idx').on(table.targetNodeId),
}));

// 工作流实例表
export const workflowInstances = pgTable('workflow_instances', {
  id: serial('id').primaryKey(),
  
  // 关联定义
  definitionId: integer('definition_id').notNull().references(() => workflowDefinitions.id),
  definitionVersion: integer('definition_version').notNull(), // 启动时的版本
  
  // 业务关联
  businessType: varchar('business_type', { length: 50 }).notNull(),
  businessId: integer('business_id').notNull(),
  businessTitle: varchar('business_title', { length: 500 }), // 业务标题
  
  // 状态
  status: workflowInstanceStatusEnum('status').notNull().default('pending'),
  currentNodeId: integer('current_node_id').references(() => workflowNodes.id),
  
  // 变量数据
  variables: text('variables'), // JSON变量
  
  // 结果
  result: varchar('result', { length: 20 }), // approved/rejected
  resultComment: text('result_comment'),
  
  // 时间记录
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  // 创建人
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  definitionIdx: uniqueIndex('workflow_instances_definition_idx').on(table.definitionId),
  businessIdx: uniqueIndex('workflow_instances_business_idx').on(table.businessType, table.businessId),
  statusIdx: uniqueIndex('workflow_instances_status_idx').on(table.status),
  createdByIdx: uniqueIndex('workflow_instances_created_by_idx').on(table.createdBy),
}));

// 工作流任务表
export const workflowTasks = pgTable('workflow_tasks', {
  id: serial('id').primaryKey(),
  
  // 关联实例
  instanceId: integer('instance_id').notNull().references(() => workflowInstances.id, { onDelete: 'cascade' }),
  
  // 关联节点
  nodeId: integer('node_id').notNull().references(() => workflowNodes.id),
  nodeKey: varchar('node_key', { length: 50 }).notNull(),
  nodeName: varchar('node_name', { length: 100 }).notNull(),
  
  // 任务信息
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  
  // 分配信息
  assigneeType: workflowAssigneeTypeEnum('assignee_type').notNull(),
  assigneeId: integer('assignee_id').notNull(), // 用户ID
  
  // 状态
  status: workflowTaskStatusEnum('status').notNull().default('pending'),
  
  // 优先级
  priority: integer('priority').notNull().default(0), // 0普通 1重要 2紧急
  
  // 时间
  dueTime: timestamp('due_time'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  // 结果
  result: varchar('result', { length: 20 }), // approved/rejected
  comment: text('comment'),
  
  // 转办信息
  transferredFrom: integer('transferred_from').references(() => users.id),
  transferredAt: timestamp('transferred_at'),
  transferReason: text('transfer_reason'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  instanceIdx: uniqueIndex('workflow_tasks_instance_idx').on(table.instanceId),
  assigneeIdx: uniqueIndex('workflow_tasks_assignee_idx').on(table.assigneeId),
  statusIdx: uniqueIndex('workflow_tasks_status_idx').on(table.status),
  dueTimeIdx: uniqueIndex('workflow_tasks_due_time_idx').on(table.dueTime),
}));

// 工作流任务操作记录表
export const workflowTaskActions = pgTable('workflow_task_actions', {
  id: serial('id').primaryKey(),
  
  // 关联任务
  taskId: integer('task_id').notNull().references(() => workflowTasks.id, { onDelete: 'cascade' }),
  instanceId: integer('instance_id').notNull().references(() => workflowInstances.id, { onDelete: 'cascade' }),
  
  // 操作信息
  action: varchar('action', { length: 20 }).notNull(), // approve/reject/transfer/cancel
  comment: text('comment'),
  
  // 操作人
  operatorId: integer('operator_id').notNull().references(() => users.id),
  
  // 操作前状态
  beforeStatus: varchar('before_status', { length: 20 }),
  // 操作后状态
  afterStatus: varchar('after_status', { length: 20 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  taskIdx: uniqueIndex('workflow_task_actions_task_idx').on(table.taskId),
  instanceIdx: uniqueIndex('workflow_task_actions_instance_idx').on(table.instanceId),
  operatorIdx: uniqueIndex('workflow_task_actions_operator_idx').on(table.operatorId),
}));

// ============================================
// 工作流关系定义
// ============================================

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({ one, many }) => ({
  creator: one(users, {
    fields: [workflowDefinitions.createdBy],
    references: [users.id],
  }),
  nodes: many(workflowNodes),
  transitions: many(workflowTransitions),
  instances: many(workflowInstances),
}));

export const workflowNodesRelations = relations(workflowNodes, ({ one, many }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowNodes.definitionId],
    references: [workflowDefinitions.id],
  }),
  outgoingTransitions: many(workflowTransitions, { relationName: 'outgoing' }),
  incomingTransitions: many(workflowTransitions, { relationName: 'incoming' }),
}));

export const workflowTransitionsRelations = relations(workflowTransitions, ({ one }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowTransitions.definitionId],
    references: [workflowDefinitions.id],
  }),
  sourceNode: one(workflowNodes, {
    fields: [workflowTransitions.sourceNodeId],
    references: [workflowNodes.id],
    relationName: 'outgoing',
  }),
  targetNode: one(workflowNodes, {
    fields: [workflowTransitions.targetNodeId],
    references: [workflowNodes.id],
    relationName: 'incoming',
  }),
}));

export const workflowInstancesRelations = relations(workflowInstances, ({ one, many }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowInstances.definitionId],
    references: [workflowDefinitions.id],
  }),
  currentNode: one(workflowNodes, {
    fields: [workflowInstances.currentNodeId],
    references: [workflowNodes.id],
  }),
  creator: one(users, {
    fields: [workflowInstances.createdBy],
    references: [users.id],
  }),
  tasks: many(workflowTasks),
  actions: many(workflowTaskActions),
}));

export const workflowTasksRelations = relations(workflowTasks, ({ one, many }) => ({
  instance: one(workflowInstances, {
    fields: [workflowTasks.instanceId],
    references: [workflowInstances.id],
  }),
  node: one(workflowNodes, {
    fields: [workflowTasks.nodeId],
    references: [workflowNodes.id],
  }),
  transferFromUser: one(users, {
    fields: [workflowTasks.transferredFrom],
    references: [users.id],
  }),
  actions: many(workflowTaskActions),
}));

export const workflowTaskActionsRelations = relations(workflowTaskActions, ({ one }) => ({
  task: one(workflowTasks, {
    fields: [workflowTaskActions.taskId],
    references: [workflowTasks.id],
  }),
  instance: one(workflowInstances, {
    fields: [workflowTaskActions.instanceId],
    references: [workflowInstances.id],
  }),
  operator: one(users, {
    fields: [workflowTaskActions.operatorId],
    references: [users.id],
  }),
}));

// ============================================
// 工作流类型导出
// ============================================

export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;
export type NewWorkflowDefinition = typeof workflowDefinitions.$inferInsert;
export type WorkflowNode = typeof workflowNodes.$inferSelect;
export type NewWorkflowNode = typeof workflowNodes.$inferInsert;
export type WorkflowTransition = typeof workflowTransitions.$inferSelect;
export type NewWorkflowTransition = typeof workflowTransitions.$inferInsert;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type NewWorkflowInstance = typeof workflowInstances.$inferInsert;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type NewWorkflowTask = typeof workflowTasks.$inferInsert;
export type WorkflowTaskAction = typeof workflowTaskActions.$inferSelect;
export type NewWorkflowTaskAction = typeof workflowTaskActions.$inferInsert;
export type WorkflowStatus = typeof workflowStatusEnum.enumValues[number];
export type WorkflowInstanceStatus = typeof workflowInstanceStatusEnum.enumValues[number];
export type WorkflowNodeType = typeof workflowNodeTypeEnum.enumValues[number];
export type WorkflowTaskStatus = typeof workflowTaskStatusEnum.enumValues[number];
export type WorkflowAssigneeType = typeof workflowAssigneeTypeEnum.enumValues[number];

// ============================================
// 成本管理枚举
// ============================================

// 成本类型枚举
export const costTypeEnum = pgEnum('cost_type', [
  'personnel',      // 人力成本
  'material',       // 材料成本
  'equipment',      // 设备成本
  'travel',         // 差旅费用
  'outsourcing',    // 外包费用
  'other',          // 其他费用
]);

// 成本状态枚举
export const costStatusEnum = pgEnum('cost_status', [
  'draft',          // 草稿
  'pending',        // 待审批
  'approved',       // 已批准
  'rejected',       // 已拒绝
  'paid',           // 已支付
]);

// 预算类型枚举
export const budgetTypeEnum = pgEnum('budget_type', [
  'total',          // 总预算
  'phase',          // 阶段预算
  'category',       // 分类预算
]);

// ============================================
// 成本预算表
// ============================================

export const costBudgets = pgTable('cost_budgets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: budgetTypeEnum('type').notNull().default('total'),
  category: costTypeEnum('category'), // 分类预算时使用
  phaseId: integer('phase_id'), // 阶段预算时关联项目阶段
  amount: varchar('amount', { length: 20 }).notNull(), // 预算金额（使用字符串避免精度问题）
  currency: varchar('currency', { length: 10 }).notNull().default('CNY'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  description: text('description'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 成本记录表
// ============================================

export const costRecords = pgTable('cost_records', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  budgetId: integer('budget_id').references(() => costBudgets.id),
  type: costTypeEnum('type').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  amount: varchar('amount', { length: 20 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('CNY'),
  status: costStatusEnum('status').notNull().default('draft'),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
  invoiceFile: varchar('invoice_file', { length: 500 }),
  occurredDate: timestamp('occurred_date').notNull(),
  description: text('description'),
  approverId: integer('approver_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  approvalNote: text('approval_note'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 成本分析报告表
// ============================================

export const costReports = pgTable('cost_reports', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  title: varchar('title', { length: 200 }).notNull(),
  reportDate: timestamp('report_date').notNull(),
  totalBudget: varchar('total_budget', { length: 20 }).notNull(),
  actualCost: varchar('actual_cost', { length: 20 }).notNull(),
  varianceAmount: varchar('variance_amount', { length: 20 }).notNull(),
  varianceRate: varchar('variance_rate', { length: 10 }).notNull(),
  costByType: text('cost_by_type'), // JSON格式存储各类型成本
  costByPhase: text('cost_by_phase'), // JSON格式存储各阶段成本
  analysis: text('analysis'), // 成本分析内容
  recommendations: text('recommendations'), // 优化建议
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 成本管理关系定义
// ============================================

export const costBudgetsRelations = relations(costBudgets, ({ one, many }) => ({
  project: one(projects, {
    fields: [costBudgets.projectId],
    references: [projects.id],
  }),
  costs: many(costRecords),
  creator: one(users, {
    fields: [costBudgets.createdBy],
    references: [users.id],
  }),
}));

export const costRecordsRelations = relations(costRecords, ({ one }) => ({
  project: one(projects, {
    fields: [costRecords.projectId],
    references: [projects.id],
  }),
  budget: one(costBudgets, {
    fields: [costRecords.budgetId],
    references: [costBudgets.id],
  }),
  approver: one(users, {
    fields: [costRecords.approverId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [costRecords.createdBy],
    references: [users.id],
  }),
}));

export const costReportsRelations = relations(costReports, ({ one }) => ({
  project: one(projects, {
    fields: [costReports.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [costReports.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// 成本管理类型导出
// ============================================

export type CostBudget = typeof costBudgets.$inferSelect;
export type NewCostBudget = typeof costBudgets.$inferInsert;
export type CostRecord = typeof costRecords.$inferSelect;
export type NewCostRecord = typeof costRecords.$inferInsert;
export type CostReport = typeof costReports.$inferSelect;
export type NewCostReport = typeof costReports.$inferInsert;
export type CostType = typeof costTypeEnum.enumValues[number];
export type CostStatus = typeof costStatusEnum.enumValues[number];
export type BudgetType = typeof budgetTypeEnum.enumValues[number];

// ============================================
// 竞争对手管理枚举
// ============================================

export const competitorLevelEnum = pgEnum('competitor_level', [
  'strategic',    // 战略竞争对手
  'major',        // 主要竞争对手
  'general',      // 一般竞争对手
  'potential',    // 潜在竞争对手
]);

export const competitorStatusEnum = pgEnum('competitor_status', [
  'active',       // 活跃
  'inactive',     // 不活跃
  'merged',       // 已合并
  'bankrupt',     // 已破产
]);

// ============================================
// 竞争对手表
// ============================================

export const competitors = pgTable('competitors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  shortName: varchar('short_name', { length: 100 }),
  level: competitorLevelEnum('level').notNull().default('general'),
  status: competitorStatusEnum('status').notNull().default('active'),
  
  creditCode: varchar('credit_code', { length: 50 }),
  registeredCapital: varchar('registered_capital', { length: 50 }),
  establishedDate: timestamp('established_date'),
  legalPerson: varchar('legal_person', { length: 50 }),
  address: varchar('address', { length: 500 }),
  website: varchar('website', { length: 200 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  
  industry: varchar('industry', { length: 100 }),
  mainBusiness: text('main_business'),
  advantageFields: text('advantage_fields'),
  qualificationCount: integer('qualification_count').default(0),
  employeeCount: varchar('employee_count', { length: 50 }),
  
  strengths: text('strengths'),
  weaknesses: text('weaknesses'),
  strategies: text('strategies'),
  winRate: integer('win_rate').default(0),
  
  totalBids: integer('total_bids').default(0),
  winBids: integer('win_bids').default(0),
  avgBidAmount: varchar('avg_bid_amount', { length: 50 }),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 竞争对手交锋记录表
// ============================================

export const competitorEncounters = pgTable('competitor_encounters', {
  id: serial('id').primaryKey(),
  competitorId: integer('competitor_id').notNull().references(() => competitors.id),
  projectId: integer('project_id').notNull().references(() => projects.id),
  
  projectName: varchar('project_name', { length: 200 }).notNull(),
  projectOwner: varchar('project_owner', { length: 200 }),
  bidDate: timestamp('bid_date').notNull(),
  
  ourPrice: varchar('our_price', { length: 50 }),
  competitorPrice: varchar('competitor_price', { length: 50 }),
  winnerPrice: varchar('winner_price', { length: 50 }),
  budgetPrice: varchar('budget_price', { length: 50 }),
  
  winner: varchar('winner', { length: 50 }),
  priceGap: varchar('price_gap', { length: 50 }),
  loseReason: text('lose_reason'),
  lessonsLearned: text('lessons_learned'),
  
  ourScore: varchar('our_score', { length: 50 }),
  competitorScore: varchar('competitor_score', { length: 50 }),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 竞争对手关系定义
// ============================================

export const competitorsRelations = relations(competitors, ({ one, many }) => ({
  creator: one(users, {
    fields: [competitors.createdBy],
    references: [users.id],
  }),
  encounters: many(competitorEncounters),
}));

export const competitorEncountersRelations = relations(competitorEncounters, ({ one }) => ({
  competitor: one(competitors, {
    fields: [competitorEncounters.competitorId],
    references: [competitors.id],
  }),
  project: one(projects, {
    fields: [competitorEncounters.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [competitorEncounters.createdBy],
    references: [users.id],
  }),
}));

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
export type CompetitorEncounter = typeof competitorEncounters.$inferSelect;
export type NewCompetitorEncounter = typeof competitorEncounters.$inferInsert;

// ============================================
// 投标决策评审枚举
// ============================================

export const decisionStatusEnum = pgEnum('decision_status', [
  'draft',        // 草稿
  'pending',      // 待评审
  'approved',     // 通过
  'rejected',     // 拒绝
  'cancelled',    // 已取消
]);

export const decisionResultEnum = pgEnum('decision_result', [
  'bid',          // 决定投标
  'no_bid',       // 决定不投
  'conditional',  // 有条件投标
]);

// ============================================
// 投标决策评审表
// ============================================

export const bidDecisions = pgTable('bid_decisions', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  
  projectName: varchar('project_name', { length: 200 }).notNull(),
  tenderCode: varchar('tender_code', { length: 100 }),
  tenderOrganization: varchar('tender_organization', { length: 200 }),
  tenderAgent: varchar('tender_agent', { length: 200 }),
  estimatedAmount: varchar('estimated_amount', { length: 50 }),
  
  publishDate: timestamp('publish_date'),
  registerDeadline: timestamp('register_deadline'),
  submissionDeadline: timestamp('submission_deadline'),
  
  technicalMatch: integer('technical_match'),
  resourceMatch: integer('resource_match'),
  experienceMatch: integer('experience_match'),
  riskLevel: varchar('risk_level', { length: 20 }),
  overallScore: integer('overall_score'),
  
  opportunityAnalysis: text('opportunity_analysis'),
  riskAnalysis: text('risk_analysis'),
  resourceRequirement: text('resource_requirement'),
  estimatedCost: varchar('estimated_cost', { length: 50 }),
  expectedProfit: varchar('expected_profit', { length: 50 }),
  winProbability: integer('win_probability'),
  
  knownCompetitors: text('known_competitors'),
  competitorAnalysis: text('competitor_analysis'),
  
  status: decisionStatusEnum('status').notNull().default('draft'),
  result: decisionResultEnum('result'),
  decisionReason: text('decision_reason'),
  decisionConditions: text('decision_conditions'),
  approvedAt: timestamp('approved_at'),
  approvedBy: integer('approved_by').references(() => users.id),
  
  meetingDate: timestamp('meeting_date'),
  meetingParticipants: text('meeting_participants'),
  meetingNotes: text('meeting_notes'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 投标决策评审记录表
// ============================================

export const bidDecisionReviews = pgTable('bid_decision_reviews', {
  id: serial('id').primaryKey(),
  decisionId: integer('decision_id').notNull().references(() => bidDecisions.id),
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  reviewOrder: integer('review_order').notNull().default(1),
  
  result: decisionResultEnum('result'),
  score: integer('score'),
  comment: text('comment'),
  conditions: text('conditions'),
  
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 投标决策关系定义
// ============================================

export const bidDecisionsRelations = relations(bidDecisions, ({ one, many }) => ({
  project: one(projects, {
    fields: [bidDecisions.projectId],
    references: [projects.id],
  }),
  approver: one(users, {
    fields: [bidDecisions.approvedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [bidDecisions.createdBy],
    references: [users.id],
  }),
  reviews: many(bidDecisionReviews),
}));

export const bidDecisionReviewsRelations = relations(bidDecisionReviews, ({ one }) => ({
  decision: one(bidDecisions, {
    fields: [bidDecisionReviews.decisionId],
    references: [bidDecisions.id],
  }),
  reviewer: one(users, {
    fields: [bidDecisionReviews.reviewerId],
    references: [users.id],
  }),
}));

export type BidDecision = typeof bidDecisions.$inferSelect;
export type NewBidDecision = typeof bidDecisions.$inferInsert;
export type BidDecisionReview = typeof bidDecisionReviews.$inferSelect;
export type NewBidDecisionReview = typeof bidDecisionReviews.$inferInsert;
export type DecisionStatus = typeof decisionStatusEnum.enumValues[number];
export type DecisionResult = typeof decisionResultEnum.enumValues[number];

// ============================================
// 资质证照枚举
// ============================================

export const qualificationTypeEnum = pgEnum('qualification_type', [
  'business_license',    // 营业执照
  'industry_license',    // 行业资质
  'iso_certification',   // ISO认证
  'safety_license',      // 安全许可证
  'professional_cert',   // 专业资质
  'patent',              // 专利
  'trademark',           // 商标
  'other',               // 其他
]);

export const qualificationStatusEnum = pgEnum('qualification_status', [
  'valid',        // 有效
  'expiring',     // 即将过期
  'expired',      // 已过期
  'renewing',     // 续期中
  'revoked',      // 已注销
]);

// ============================================
// 资质证照表
// ============================================

export const qualifications = pgTable('qualifications', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  type: qualificationTypeEnum('type').notNull(),
  code: varchar('code', { length: 100 }),
  
  issuingAuthority: varchar('issuing_authority', { length: 200 }),
  qualificationLevel: varchar('qualification_level', { length: 50 }),
  businessScope: text('business_scope'),
  industry: varchar('industry', { length: 100 }),
  region: varchar('region', { length: 100 }),
  
  issueDate: timestamp('issue_date'),
  validFrom: timestamp('valid_from'),
  validTo: timestamp('valid_to'),
  status: qualificationStatusEnum('status').notNull().default('valid'),
  
  originalFile: varchar('original_file', { length: 500 }),
  copies: integer('copies').default(0),
  attachments: text('attachments'),
  
  remindDays: integer('remind_days').default(30),
  lastRemindAt: timestamp('last_remind_at'),
  
  managerId: integer('manager_id').references(() => users.id),
  storageLocation: varchar('storage_location', { length: 200 }),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 资质借用记录表
// ============================================

export const qualificationBorrows = pgTable('qualification_borrows', {
  id: serial('id').primaryKey(),
  qualificationId: integer('qualification_id').notNull().references(() => qualifications.id),
  projectId: integer('project_id').references(() => projects.id),
  
  borrowerId: integer('borrower_id').notNull().references(() => users.id),
  borrowPurpose: varchar('borrow_purpose', { length: 200 }).notNull(),
  borrowDate: timestamp('borrow_date').notNull(),
  expectedReturnDate: timestamp('expected_return_date').notNull(),
  actualReturnDate: timestamp('actual_return_date'),
  
  status: varchar('status', { length: 20 }).notNull().default('borrowed'),
  notes: text('notes'),
  
  approvedBy: integer('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 资质证照关系定义
// ============================================

export const qualificationsRelations = relations(qualifications, ({ one, many }) => ({
  manager: one(users, {
    fields: [qualifications.managerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [qualifications.createdBy],
    references: [users.id],
  }),
  borrows: many(qualificationBorrows),
}));

export const qualificationBorrowsRelations = relations(qualificationBorrows, ({ one }) => ({
  qualification: one(qualifications, {
    fields: [qualificationBorrows.qualificationId],
    references: [qualifications.id],
  }),
  project: one(projects, {
    fields: [qualificationBorrows.projectId],
    references: [projects.id],
  }),
  borrower: one(users, {
    fields: [qualificationBorrows.borrowerId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [qualificationBorrows.approvedBy],
    references: [users.id],
  }),
}));

export type Qualification = typeof qualifications.$inferSelect;
export type NewQualification = typeof qualifications.$inferInsert;
export type QualificationBorrow = typeof qualificationBorrows.$inferSelect;
export type NewQualificationBorrow = typeof qualificationBorrows.$inferInsert;
export type QualificationType = typeof qualificationTypeEnum.enumValues[number];
export type QualificationStatus = typeof qualificationStatusEnum.enumValues[number];

// ============================================
// 项目组织架构枚举
// ============================================

export const orgTemplateTypeEnum = pgEnum('org_template_type', [
  'standard',     // 标准投标模板
  'complex',      // 复杂项目模板
  'custom',       // 自定义模板
]);

export const permissionLevelEnum = pgEnum('permission_level', [
  'level_1',      // 一级权限（项目负责人、投标总监）
  'level_2',      // 二级权限（技术负责人、商务负责人）
  'level_3',      // 三级权限（普通成员）
]);

// ============================================
// 组织架构模板表
// ============================================

export const orgTemplates = pgTable('org_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: orgTemplateTypeEnum('type').notNull().default('standard'),
  description: text('description'),
  positions: text('positions').notNull(), // JSON数组存储岗位配置
  isSystem: boolean('is_system').notNull().default(false), // 是否系统预置模板
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 项目组织架构表
// ============================================

export const projectOrgs = pgTable('project_orgs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  templateId: integer('template_id').references(() => orgTemplates.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active/archived
  archivedAt: timestamp('archived_at'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: uniqueIndex('project_orgs_project_idx').on(table.projectId),
}));

// ============================================
// 项目岗位表
// ============================================

export const projectPositions = pgTable('project_positions', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => projectOrgs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  permissionLevel: permissionLevelEnum('permission_level').notNull().default('level_3'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: uniqueIndex('project_positions_org_idx').on(table.orgId),
}));

// ============================================
// 项目组织成员表
// ============================================

export const projectOrgMembers = pgTable('project_org_members', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => projectOrgs.id, { onDelete: 'cascade' }),
  positionId: integer('position_id').references(() => projectPositions.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  
  // 外部成员信息
  isExternal: boolean('is_external').notNull().default(false),
  externalName: varchar('external_name', { length: 50 }),
  externalPhone: varchar('external_phone', { length: 20 }),
  externalEmail: varchar('external_email', { length: 100 }),
  
  // 权限
  permissionLevel: permissionLevelEnum('permission_level').notNull().default('level_3'),
  
  // 状态
  status: varchar('status', { length: 20 }).notNull().default('active'), // active/removed
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  removedAt: timestamp('removed_at'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: uniqueIndex('project_org_members_org_idx').on(table.orgId),
  userOrgIdx: uniqueIndex('project_org_members_user_org_idx').on(table.orgId, table.userId),
}));

// ============================================
// 归档的组织架构模板表
// ============================================

export const archivedOrgTemplates = pgTable('archived_org_templates', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  projectName: varchar('project_name', { length: 200 }).notNull(),
  projectCode: varchar('project_code', { length: 50 }),
  orgData: text('org_data').notNull(), // JSON格式存储完整组织架构
  archivedAt: timestamp('archived_at').notNull().defaultNow(),
  archivedBy: integer('archived_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: uniqueIndex('archived_org_templates_project_idx').on(table.projectId),
}));

// ============================================
// 项目讨论区表
// ============================================

export const projectDiscussions = pgTable('project_discussions', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  orgId: integer('org_id').notNull().references(() => projectOrgs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active/archived
  archivedAt: timestamp('archived_at'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: uniqueIndex('project_discussions_project_idx').on(table.projectId),
}));

// ============================================
// 讨论区消息表
// ============================================

export const discussionMessages = pgTable('discussion_messages', {
  id: serial('id').primaryKey(),
  discussionId: integer('discussion_id').notNull().references(() => projectDiscussions.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id'), // 回复的消息ID
  
  content: text('content').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('text'), // text/file/system
  
  // 提及成员
  mentions: text('mentions'), // JSON数组存储被@的成员ID
  
  // 文件信息
  fileId: integer('file_id').references(() => files.id, { onDelete: 'set null' }),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'),
  fileType: varchar('file_type', { length: 50 }),
  
  // 消息状态
  isPinned: boolean('is_pinned').notNull().default(false),
  pinnedAt: timestamp('pinned_at'),
  pinnedBy: integer('pinned_by').references(() => users.id),
  
  isEdited: boolean('is_edited').notNull().default(false),
  editedAt: timestamp('edited_at'),
  
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  deletedBy: integer('deleted_by').references(() => users.id),
  
  authorId: integer('author_id').notNull().references(() => users.id),
  authorName: varchar('author_name', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  discussionIdx: uniqueIndex('discussion_messages_discussion_idx').on(table.discussionId),
  parentIdx: uniqueIndex('discussion_messages_parent_idx').on(table.parentId),
}));

// ============================================
// 讨论区文件表
// ============================================

export const discussionFiles = pgTable('discussion_files', {
  id: serial('id').primaryKey(),
  discussionId: integer('discussion_id').notNull().references(() => projectDiscussions.id, { onDelete: 'cascade' }),
  messageId: integer('message_id').references(() => discussionMessages.id, { onDelete: 'set null' }),
  fileId: integer('file_id').references(() => files.id, { onDelete: 'set null' }),
  
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size'),
  fileType: varchar('file_type', { length: 50 }),
  
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  deletedBy: integer('deleted_by').references(() => users.id),
}, (table) => ({
  discussionIdx: uniqueIndex('discussion_files_discussion_idx').on(table.discussionId),
}));

// ============================================
// 项目组织架构关系定义
// ============================================

export const orgTemplatesRelations = relations(orgTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [orgTemplates.createdBy],
    references: [users.id],
  }),
}));

export const projectOrgsRelations = relations(projectOrgs, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectOrgs.projectId],
    references: [projects.id],
  }),
  template: one(orgTemplates, {
    fields: [projectOrgs.templateId],
    references: [orgTemplates.id],
  }),
  creator: one(users, {
    fields: [projectOrgs.createdBy],
    references: [users.id],
  }),
  positions: many(projectPositions),
  members: many(projectOrgMembers),
}));

export const projectPositionsRelations = relations(projectPositions, ({ one, many }) => ({
  org: one(projectOrgs, {
    fields: [projectPositions.orgId],
    references: [projectOrgs.id],
  }),
  members: many(projectOrgMembers),
}));

export const projectOrgMembersRelations = relations(projectOrgMembers, ({ one }) => ({
  org: one(projectOrgs, {
    fields: [projectOrgMembers.orgId],
    references: [projectOrgs.id],
  }),
  position: one(projectPositions, {
    fields: [projectOrgMembers.positionId],
    references: [projectPositions.id],
  }),
  user: one(users, {
    fields: [projectOrgMembers.userId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [projectOrgMembers.createdBy],
    references: [users.id],
  }),
}));

export const archivedOrgTemplatesRelations = relations(archivedOrgTemplates, ({ one }) => ({
  project: one(projects, {
    fields: [archivedOrgTemplates.projectId],
    references: [projects.id],
  }),
  archiver: one(users, {
    fields: [archivedOrgTemplates.archivedBy],
    references: [users.id],
  }),
}));

// ============================================
// 项目讨论区关系定义
// ============================================

export const projectDiscussionsRelations = relations(projectDiscussions, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectDiscussions.projectId],
    references: [projects.id],
  }),
  org: one(projectOrgs, {
    fields: [projectDiscussions.orgId],
    references: [projectOrgs.id],
  }),
  creator: one(users, {
    fields: [projectDiscussions.createdBy],
    references: [users.id],
  }),
  messages: many(discussionMessages),
  files: many(discussionFiles),
}));

export const discussionMessagesRelations = relations(discussionMessages, ({ one, many }) => ({
  discussion: one(projectDiscussions, {
    fields: [discussionMessages.discussionId],
    references: [projectDiscussions.id],
  }),
  parent: one(discussionMessages, {
    fields: [discussionMessages.parentId],
    references: [discussionMessages.id],
    relationName: 'replies',
  }),
  replies: many(discussionMessages, { relationName: 'replies' }),
  author: one(users, {
    fields: [discussionMessages.authorId],
    references: [users.id],
  }),
  pinner: one(users, {
    fields: [discussionMessages.pinnedBy],
    references: [users.id],
  }),
  deleter: one(users, {
    fields: [discussionMessages.deletedBy],
    references: [users.id],
  }),
  file: one(files, {
    fields: [discussionMessages.fileId],
    references: [files.id],
  }),
}));

export const discussionFilesRelations = relations(discussionFiles, ({ one }) => ({
  discussion: one(projectDiscussions, {
    fields: [discussionFiles.discussionId],
    references: [projectDiscussions.id],
  }),
  message: one(discussionMessages, {
    fields: [discussionFiles.messageId],
    references: [discussionMessages.id],
  }),
  file: one(files, {
    fields: [discussionFiles.fileId],
    references: [files.id],
  }),
  uploader: one(users, {
    fields: [discussionFiles.uploadedBy],
    references: [users.id],
  }),
  deleter: one(users, {
    fields: [discussionFiles.deletedBy],
    references: [users.id],
  }),
}));

// ============================================
// 项目组织架构类型导出
// ============================================

export type OrgTemplate = typeof orgTemplates.$inferSelect;
export type NewOrgTemplate = typeof orgTemplates.$inferInsert;
export type ProjectOrg = typeof projectOrgs.$inferSelect;
export type NewProjectOrg = typeof projectOrgs.$inferInsert;
export type ProjectPosition = typeof projectPositions.$inferSelect;
export type NewProjectPosition = typeof projectPositions.$inferInsert;
export type ProjectOrgMember = typeof projectOrgMembers.$inferSelect;
export type NewProjectOrgMember = typeof projectOrgMembers.$inferInsert;
export type ArchivedOrgTemplate = typeof archivedOrgTemplates.$inferSelect;
export type NewArchivedOrgTemplate = typeof archivedOrgTemplates.$inferInsert;
export type OrgTemplateType = typeof orgTemplateTypeEnum.enumValues[number];
export type PermissionLevel = typeof permissionLevelEnum.enumValues[number];

// ============================================
// 项目讨论区类型导出
// ============================================

export type ProjectDiscussion = typeof projectDiscussions.$inferSelect;
export type NewProjectDiscussion = typeof projectDiscussions.$inferInsert;
export type DiscussionMessage = typeof discussionMessages.$inferSelect;
export type NewDiscussionMessage = typeof discussionMessages.$inferInsert;
export type DiscussionFile = typeof discussionFiles.$inferSelect;
export type NewDiscussionFile = typeof discussionFiles.$inferInsert;

// ============================================
// 保证金管理枚举
// ============================================

export const guaranteeTypeEnum = pgEnum('guarantee_type', [
  'cash',         // 现金
  'bank_guarantee', // 银行保函
  'insurance',    // 保险保函
]);

export const guaranteeStatusEnum = pgEnum('guarantee_status', [
  'pending',      // 待缴纳
  'paid',         // 已缴纳
  'returned',     // 已退还
  'forfeited',    // 已没收
  'partial',      // 部分退还
]);

// ============================================
// 投标保证金表
// ============================================

export const bidGuarantees = pgTable('bid_guarantees', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  
  amount: varchar('amount', { length: 50 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('CNY'),
  type: guaranteeTypeEnum('type').notNull().default('cash'),
  
  guaranteeNumber: varchar('guarantee_number', { length: 100 }),
  issuingBank: varchar('issuing_bank', { length: 200 }),
  guaranteeValidFrom: timestamp('guarantee_valid_from'),
  guaranteeValidTo: timestamp('guarantee_valid_to'),
  guaranteeFile: varchar('guarantee_file', { length: 500 }),
  
  // 时间管理
  plannedDate: timestamp('planned_date'), // 计划缴纳日期
  actualDate: timestamp('actual_date'), // 实际完成日期
  
  paymentDate: timestamp('payment_date'),
  paymentVoucher: varchar('payment_voucher', { length: 500 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  
  // 退保证金流程
  returnApplicationDate: timestamp('return_application_date'), // 退还申请日期
  returnStatus: varchar('return_status', { length: 20 }).default('not_applied'), // 退还状态: not_applied/applied/processing/returned/rejected
  returnHandlerId: integer('return_handler_id').references(() => users.id), // 退还处理人
  returnHandlerName: varchar('return_handler_name', { length: 50 }), // 退还处理人姓名
  returnApprovedAt: timestamp('return_approved_at'), // 退还审批时间
  
  returnDate: timestamp('return_date'),
  returnAmount: varchar('return_amount', { length: 50 }),
  returnVoucher: varchar('return_voucher', { length: 500 }),
  returnReason: text('return_reason'),
  
  // 任务指派
  assigneeId: integer('assignee_id').references(() => users.id), // 指派给谁
  assigneeName: varchar('assignee_name', { length: 50 }), // 指派人姓名（冗余）
  priority: varchar('priority', { length: 20 }).default('medium'), // 优先级: high/medium/low
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id), // 关联的任务ID
  pushedToTask: boolean('pushed_to_task').default(false), // 是否已推送到任务中心
  pushedAt: timestamp('pushed_at'), // 推送时间
  
  status: guaranteeStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('bid_guarantees_project_idx').on(table.projectId),
  statusIdx: index('bid_guarantees_status_idx').on(table.status),
  assigneeIdx: index('bid_guarantees_assignee_idx').on(table.assigneeId),
  taskIdx: index('bid_guarantees_task_idx').on(table.taskId),
  returnStatusIdx: index('bid_guarantees_return_status_idx').on(table.returnStatus),
}));

// ============================================
// 保证金关系定义
// ============================================

export const bidGuaranteesRelations = relations(bidGuarantees, ({ one }) => ({
  project: one(projects, {
    fields: [bidGuarantees.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [bidGuarantees.createdBy],
    references: [users.id],
  }),
  assignee: one(users, {
    fields: [bidGuarantees.assigneeId],
    references: [users.id],
    relationName: 'guarantee_assignee',
  }),
  returnHandler: one(users, {
    fields: [bidGuarantees.returnHandlerId],
    references: [users.id],
    relationName: 'guarantee_return_handler',
  }),
  task: one(projectTasks, {
    fields: [bidGuarantees.taskId],
    references: [projectTasks.id],
  }),
}));

export type BidGuarantee = typeof bidGuarantees.$inferSelect;
export type NewBidGuarantee = typeof bidGuarantees.$inferInsert;
export type GuaranteeType = typeof guaranteeTypeEnum.enumValues[number];
export type GuaranteeStatus = typeof guaranteeStatusEnum.enumValues[number];

// ============================================
// 开标记录枚举
// ============================================

export const bidOpeningStatusEnum = pgEnum('bid_opening_status', [
  'pending',      // 待开标
  'opened',       // 已开标
  'cancelled',    // 已废标
  'postponed',    // 已延期
]);

// ============================================
// 开标记录表
// ============================================

export const bidOpenings = pgTable('bid_openings', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  
  projectName: varchar('project_name', { length: 200 }).notNull(),
  tenderCode: varchar('tender_code', { length: 100 }),
  
  openingDate: timestamp('opening_date').notNull(),
  openingLocation: varchar('opening_location', { length: 200 }),
  
  ourBidPrice: varchar('our_bid_price', { length: 50 }),
  ourScore: varchar('our_score', { length: 50 }),
  
  status: bidOpeningStatusEnum('status').notNull().default('pending'),
  winnerName: varchar('winner_name', { length: 200 }),
  winnerPrice: varchar('winner_price', { length: 50 }),
  budgetPrice: varchar('budget_price', { length: 50 }),
  
  analysis: text('analysis'),
  lessonsLearned: text('lessons_learned'),
  
  photos: text('photos'),
  attachments: text('attachments'),
  participants: text('participants'),
  notes: text('notes'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 开标报价对比表
// ============================================

export const bidOpeningQuotes = pgTable('bid_opening_quotes', {
  id: serial('id').primaryKey(),
  openingId: integer('opening_id').notNull().references(() => bidOpenings.id),
  
  bidderName: varchar('bidder_name', { length: 200 }).notNull(),
  bidderType: varchar('bidder_type', { length: 20 }),
  competitorId: integer('competitor_id').references(() => competitors.id),
  
  bidPrice: varchar('bid_price', { length: 50 }),
  score: varchar('score', { length: 50 }),
  rank: integer('rank'),
  isWinner: boolean('is_winner').notNull().default(false),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 开标记录关系定义
// ============================================

export const bidOpeningsRelations = relations(bidOpenings, ({ one, many }) => ({
  project: one(projects, {
    fields: [bidOpenings.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [bidOpenings.createdBy],
    references: [users.id],
  }),
  quotes: many(bidOpeningQuotes),
}));

export const bidOpeningQuotesRelations = relations(bidOpeningQuotes, ({ one }) => ({
  opening: one(bidOpenings, {
    fields: [bidOpeningQuotes.openingId],
    references: [bidOpenings.id],
  }),
  competitor: one(competitors, {
    fields: [bidOpeningQuotes.competitorId],
    references: [competitors.id],
  }),
}));

export type BidOpening = typeof bidOpenings.$inferSelect;
export type NewBidOpening = typeof bidOpenings.$inferInsert;
export type BidOpeningQuote = typeof bidOpeningQuotes.$inferSelect;
export type NewBidOpeningQuote = typeof bidOpeningQuotes.$inferInsert;
export type BidOpeningStatus = typeof bidOpeningStatusEnum.enumValues[number];

// ============================================
// 投标准备 - 授权申请模块
// ============================================

// 授权申请状态枚举
export const authorizationStatusEnum = pgEnum('authorization_status', [
  'draft',           // 待提交
  'pending_review',  // 待审核
  'approved',        // 审核通过
  'rejected',        // 审核驳回
  'material_pending', // 材料待接收
  'material_received', // 材料已接收
  'completed',       // 授权完成
  'terminated',      // 申请终止
]);

// 厂家类型枚举
export const manufacturerTypeEnum = pgEnum('manufacturer_type', [
  'main',   // 主投
  'partner', // 陪标
]);

// 配置偏离类型枚举
export const deviationTypeEnum = pgEnum('deviation_type', [
  'none',     // 无偏离
  'positive', // 正偏离（主投可高于）
  'negative', // 负偏离（禁止）
]);

// 审核环节枚举
export const reviewStageEnum = pgEnum('review_stage', [
  'completeness',  // 材料完整性审核
  'authenticity',  // 材料真实性审核
  'compliance',    // 授权合规性审核
  'final',         // 最终授权审核
]);

// 审核结果枚举
export const reviewResultEnum = pgEnum('review_result', [
  'pending',   // 未审核
  'approved',  // 审核通过
  'rejected',  // 审核驳回
]);

// 待办事项状态枚举
export const todoStatusEnum = pgEnum('todo_status', [
  'not_started', // 未开始
  'in_progress', // 进行中
  'completed',   // 已完成
  'overdue',     // 逾期
]);

// 待办追踪状态枚举
export const trackingStatusEnum = pgEnum('tracking_status', [
  'not_tracked', // 未追踪
  'tracking',    // 追踪中
  'completed',   // 已完成
]);

// ============================================
// 授权申请主表
// ============================================

export const authorizationApplications = pgTable('authorization_applications', {
  id: serial('id').primaryKey(),
  
  // 申请单编号（关联项目编号）
  applicationNo: varchar('application_no', { length: 50 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  
  // 申请日期
  applicationDate: timestamp('application_date').notNull().defaultNow(),
  
  // 经办人信息
  handlerId: integer('handler_id').notNull().references(() => users.id),
  handlerName: varchar('handler_name', { length: 50 }).notNull(),
  handlerPhone: varchar('handler_phone', { length: 20 }),
  
  // 申请状态
  status: authorizationStatusEnum('status').notNull().default('draft'),
  
  // 材料最迟送达时间
  materialDeadline: timestamp('material_deadline'),
  
  // 材料接收确认时间
  electronicMaterialReceivedAt: timestamp('electronic_material_received_at'),
  paperMaterialReceivedAt: timestamp('paper_material_received_at'),
  allMaterialReceivedAt: timestamp('all_material_received_at'),
  
  // 补充说明
  supplementaryNotes: text('supplementary_notes'),
  
  // 待办追踪状态
  trackingStatus: trackingStatusEnum('tracking_status').notNull().default('not_tracked'),
  
  // 项目信息（从文件解读模块提取）
  projectName: varchar('project_name', { length: 200 }),
  projectCode: varchar('project_code', { length: 100 }),
  tenderOrganization: varchar('tender_organization', { length: 200 }),
  submissionDeadline: timestamp('submission_deadline'),
  interpretationFileId: integer('interpretation_file_id'), // 关联解读文件ID
  
  // 项目信息修改原因
  projectInfoChangeReason: text('project_info_change_reason'),
  
  // 创建者
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationNoIdx: uniqueIndex('authorization_applications_no_idx').on(table.applicationNo),
  projectIdIdx: uniqueIndex('authorization_applications_project_idx').on(table.projectId),
  statusIdx: uniqueIndex('authorization_applications_status_idx').on(table.status),
}));

// ============================================
// 授权厂家表
// ============================================

export const authorizationManufacturers = pgTable('authorization_manufacturers', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => authorizationApplications.id, { onDelete: 'cascade' }),
  
  // 厂家类型（主投/陪标）
  type: manufacturerTypeEnum('type').notNull(),
  
  // 厂家信息（可从公司管理模块选择或手动新增）
  companyId: integer('company_id').references(() => companies.id, { onDelete: 'set null' }),
  manufacturerName: varchar('manufacturer_name', { length: 200 }).notNull(),
  manufacturerAddress: varchar('manufacturer_address', { length: 500 }),
  contactPerson: varchar('contact_person', { length: 50 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  
  // 产品信息
  productName: varchar('product_name', { length: 200 }),
  
  // 产品配置参数
  productConfig: text('product_config'), // 可粘贴参数或上传参数表
  
  // 配置偏离说明
  deviationType: deviationTypeEnum('deviation_type').notNull().default('none'),
  deviationNotes: text('deviation_notes'),
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('authorization_manufacturers_application_idx').on(table.applicationId),
}));

// ============================================
// 厂家资质材料表
// ============================================

export const authorizationQualifications = pgTable('authorization_qualifications', {
  id: serial('id').primaryKey(),
  manufacturerId: integer('manufacturer_id').notNull().references(() => authorizationManufacturers.id, { onDelete: 'cascade' }),
  
  // 资质材料类别
  category: varchar('category', { length: 50 }).notNull(), // 营业执照/ISO系列证书/产品3C认证证书等
  customCategoryName: varchar('custom_category_name', { length: 100 }), // 自定义材料名称
  
  // 是否提供
  isProvided: boolean('is_provided').notNull().default(false),
  
  // 材料备注（版本/有效期等）
  notes: text('notes'),
  
  // 材料上传/附件
  fileId: integer('file_id').references(() => files.id, { onDelete: 'set null' }),
  fileUrl: varchar('file_url', { length: 500 }),
  submitType: varchar('submit_type', { length: 20 }).default('upload'), // upload/offline
  
  // 业绩材料
  hasPerformance: boolean('has_performance').default(false),
  performanceType: text('performance_type'), // JSON数组：合同复印件/中标通知书/验收报告
  performanceNotes: text('performance_notes'),
  performanceYear: timestamp('performance_year'),
  
  // 有效期
  validFrom: timestamp('valid_from'),
  validTo: timestamp('valid_to'),
  
  // 供货周期
  supplyCycle: varchar('supply_cycle', { length: 100 }),
  supplyCapacityNotes: text('supply_capacity_notes'),
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  manufacturerIdx: uniqueIndex('authorization_qualifications_manufacturer_idx').on(table.manufacturerId),
}));

// ============================================
// 配套材料表（授权书、供货证明、售后服务承诺书）
// ============================================

export const authorizationSupportingDocs = pgTable('authorization_supporting_docs', {
  id: serial('id').primaryKey(),
  manufacturerId: integer('manufacturer_id').notNull().references(() => authorizationManufacturers.id, { onDelete: 'cascade' }),
  
  // 授权书
  authorizationLetter: text('authorization_letter'),
  authorizationLetterFileId: integer('authorization_letter_file_id').references(() => files.id, { onDelete: 'set null' }),
  
  // 供货证明
  supplyProof: text('supply_proof'),
  supplyProofFileId: integer('supply_proof_file_id').references(() => files.id, { onDelete: 'set null' }),
  
  // 售后服务承诺书
  serviceCommitment: text('service_commitment'),
  serviceCommitmentNotes: text('service_commitment_notes'),
  serviceCommitmentFileId: integer('service_commitment_file_id').references(() => files.id, { onDelete: 'set null' }),
  
  // 配套材料有效期
  validFrom: timestamp('valid_from'),
  validTo: timestamp('valid_to'),
  
  // 提交方式
  submitType: varchar('submit_type', { length: 20 }).default('upload'), // upload/offline
  
  // 确认状态
  isConfirmed: boolean('is_confirmed').notNull().default(false),
  confirmedAt: timestamp('confirmed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  manufacturerIdx: uniqueIndex('authorization_supporting_docs_manufacturer_idx').on(table.manufacturerId),
}));

// ============================================
// 材料交付记录表
// ============================================

export const authorizationDeliveries = pgTable('authorization_deliveries', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => authorizationApplications.id, { onDelete: 'cascade' }),
  
  // 交付材料类型（多选，JSON数组）
  materialTypes: text('material_types').notNull(), // 全部纸质材料/全部电子档材料/部分纸质+部分电子档
  
  // 交付方式
  deliveryMethod: varchar('delivery_method', { length: 20 }).notNull(), // upload/offline/mixed
  
  // 送达方式
  shippingMethod: varchar('shipping_method', { length: 20 }), // express/courier/flash/other
  trackingNumber: varchar('tracking_number', { length: 100 }),
  customShippingMethod: varchar('custom_shipping_method', { length: 100 }),
  
  // 实际送达时间
  deliveredAt: timestamp('delivered_at'),
  
  // 接收人确认
  receiverName: varchar('receiver_name', { length: 50 }),
  receiverSignature: varchar('receiver_signature', { length: 255 }), // 签名图片URL
  receivedAt: timestamp('received_at'),
  
  // 追溯记录
  trackingRecordGenerated: boolean('tracking_record_generated').default(false),
  trackingRecordNo: varchar('tracking_record_no', { length: 50 }),
  
  // 追溯记录附件
  logisticsVoucherFileId: integer('logistics_voucher_file_id').references(() => files.id, { onDelete: 'set null' }),
  receiptVoucherFileId: integer('receipt_voucher_file_id').references(() => files.id, { onDelete: 'set null' }),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('authorization_deliveries_application_idx').on(table.applicationId),
}));

// ============================================
// 审核记录表
// ============================================

export const authorizationReviews = pgTable('authorization_reviews', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => authorizationApplications.id, { onDelete: 'cascade' }),
  
  // 审核环节
  stage: reviewStageEnum('stage').notNull(),
  
  // 审核人
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  reviewerName: varchar('reviewer_name', { length: 50 }).notNull(),
  
  // 审核状态
  result: reviewResultEnum('result').notNull().default('pending'),
  
  // 审核意见
  comment: text('comment'),
  
  // 审核时间
  reviewedAt: timestamp('reviewed_at'),
  
  // 异常处理
  exceptionHandling: varchar('exception_handling', { length: 50 }), // none/supplement/resubmit/verify/adjust/terminate
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationStageIdx: uniqueIndex('authorization_reviews_application_stage_idx').on(table.applicationId, table.stage),
}));

// ============================================
// 待办事项表
// ============================================

export const authorizationTodos = pgTable('authorization_todos', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => authorizationApplications.id, { onDelete: 'cascade' }),
  
  // 待办事项
  title: varchar('title', { length: 200 }).notNull(),
  
  // 责任人
  assigneeId: integer('assignee_id').notNull().references(() => users.id),
  assigneeName: varchar('assignee_name', { length: 50 }).notNull(),
  
  // 截止时间
  deadline: timestamp('deadline'),
  
  // 事项进度
  status: todoStatusEnum('status').notNull().default('not_started'),
  
  // 备注
  notes: text('notes'),
  
  // 类型
  type: varchar('type', { length: 30 }).notNull(), // material_submit/material_receive/review/sync
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('authorization_todos_application_idx').on(table.applicationId),
  assigneeIdx: uniqueIndex('authorization_todos_assignee_idx').on(table.assigneeId),
}));

// ============================================
// 授权申请关系定义
// ============================================

export const authorizationApplicationsRelations = relations(authorizationApplications, ({ one, many }) => ({
  project: one(projects, {
    fields: [authorizationApplications.projectId],
    references: [projects.id],
  }),
  handler: one(users, {
    fields: [authorizationApplications.handlerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [authorizationApplications.createdBy],
    references: [users.id],
  }),
  manufacturers: many(authorizationManufacturers),
  deliveries: many(authorizationDeliveries),
  reviews: many(authorizationReviews),
  todos: many(authorizationTodos),
}));

export const authorizationManufacturersRelations = relations(authorizationManufacturers, ({ one, many }) => ({
  application: one(authorizationApplications, {
    fields: [authorizationManufacturers.applicationId],
    references: [authorizationApplications.id],
  }),
  company: one(companies, {
    fields: [authorizationManufacturers.companyId],
    references: [companies.id],
  }),
  qualifications: many(authorizationQualifications),
  supportingDoc: one(authorizationSupportingDocs),
}));

export const authorizationQualificationsRelations = relations(authorizationQualifications, ({ one }) => ({
  manufacturer: one(authorizationManufacturers, {
    fields: [authorizationQualifications.manufacturerId],
    references: [authorizationManufacturers.id],
  }),
  file: one(files, {
    fields: [authorizationQualifications.fileId],
    references: [files.id],
  }),
}));

export const authorizationSupportingDocsRelations = relations(authorizationSupportingDocs, ({ one }) => ({
  manufacturer: one(authorizationManufacturers, {
    fields: [authorizationSupportingDocs.manufacturerId],
    references: [authorizationManufacturers.id],
  }),
  authorizationLetterFile: one(files, {
    fields: [authorizationSupportingDocs.authorizationLetterFileId],
    references: [files.id],
    relationName: 'supporting_doc_auth_file',
  }),
  supplyProofFile: one(files, {
    fields: [authorizationSupportingDocs.supplyProofFileId],
    references: [files.id],
    relationName: 'supporting_doc_supply_file',
  }),
  serviceCommitmentFile: one(files, {
    fields: [authorizationSupportingDocs.serviceCommitmentFileId],
    references: [files.id],
    relationName: 'supporting_doc_service_file',
  }),
}));

export const authorizationDeliveriesRelations = relations(authorizationDeliveries, ({ one }) => ({
  application: one(authorizationApplications, {
    fields: [authorizationDeliveries.applicationId],
    references: [authorizationApplications.id],
  }),
  creator: one(users, {
    fields: [authorizationDeliveries.createdBy],
    references: [users.id],
  }),
  logisticsVoucher: one(files, {
    fields: [authorizationDeliveries.logisticsVoucherFileId],
    references: [files.id],
    relationName: 'delivery_logistics_voucher',
  }),
  receiptVoucher: one(files, {
    fields: [authorizationDeliveries.receiptVoucherFileId],
    references: [files.id],
    relationName: 'delivery_receipt_voucher',
  }),
}));

export const authorizationReviewsRelations = relations(authorizationReviews, ({ one }) => ({
  application: one(authorizationApplications, {
    fields: [authorizationReviews.applicationId],
    references: [authorizationApplications.id],
  }),
  reviewer: one(users, {
    fields: [authorizationReviews.reviewerId],
    references: [users.id],
  }),
}));

export const authorizationTodosRelations = relations(authorizationTodos, ({ one }) => ({
  application: one(authorizationApplications, {
    fields: [authorizationTodos.applicationId],
    references: [authorizationApplications.id],
  }),
  assignee: one(users, {
    fields: [authorizationTodos.assigneeId],
    references: [users.id],
  }),
}));

// ============================================
// 样机申请状态枚举
// ============================================

export const sampleApplicationStatusEnum = pgEnum('sample_application_status', [
  'draft',           // 待提交
  'pending_review',  // 待审核
  'approved',        // 审核通过
  'rejected',        // 审核驳回
  'sample_pending',  // 样机待接收
  'sample_received', // 样机已接收
  'sample_returned', // 样机已归还
  'terminated',      // 申请终止
]);

// ============================================
// 样机接收方式枚举
// ============================================

export const sampleReceiveMethodEnum = pgEnum('sample_receive_method', [
  'self_pickup',     // 上门自提
  'logistics',       // 物流送达
  'manufacturer',    // 厂家直接送达
]);

// ============================================
// 样机归还方式枚举
// ============================================

export const sampleReturnMethodEnum = pgEnum('sample_return_method', [
  'self_send',       // 我司寄送
  'manufacturer_pickup', // 厂家自提
  'other',           // 其他
]);

// ============================================
// 样机审核环节枚举
// ============================================

export const sampleReviewStageEnum = pgEnum('sample_review_stage', [
  'material_completeness',  // 样机材料完整性审核
  'specification',          // 样机规格合理性审核
  'display',                // 现场展示合理性审核
  'final',                  // 最终样机审核
]);

// ============================================
// 价格申请状态枚举
// ============================================

export const priceApplicationStatusEnum = pgEnum('price_application_status', [
  'draft',           // 待提交
  'pending_review',  // 待审核
  'approved',        // 审核通过
  'rejected',        // 审核驳回
  'terminated',      // 申请终止
]);

// ============================================
// 价格审核环节枚举
// ============================================

export const priceReviewStageEnum = pgEnum('price_review_stage', [
  'price_completeness',  // 价格材料完整性审核
  'price_rationality',   // 价格合理性审核
  'final',               // 最终价格审核
]);

// ============================================
// 样机申请主表
// ============================================

export const sampleApplications = pgTable('sample_applications', {
  id: serial('id').primaryKey(),
  
  // 申请单编号
  applicationNo: varchar('application_no', { length: 50 }).notNull().unique(),
  
  // 关联授权申请（可选）
  authorizationApplicationId: integer('authorization_application_id').references(() => authorizationApplications.id, { onDelete: 'set null' }),
  
  // 关联项目
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  
  // 申请日期
  applicationDate: timestamp('application_date').notNull().defaultNow(),
  
  // 经办人信息
  handlerId: integer('handler_id').notNull().references(() => users.id),
  handlerName: varchar('handler_name', { length: 50 }).notNull(),
  handlerPhone: varchar('handler_phone', { length: 20 }),
  
  // 申请状态
  status: sampleApplicationStatusEnum('status').notNull().default('draft'),
  
  // 样机最迟送达时间
  sampleDeadline: timestamp('sample_deadline'),
  
  // 样机接收确认时间
  sampleReceivedAt: timestamp('sample_received_at'),
  
  // 样机归还时间
  sampleReturnedAt: timestamp('sample_returned_at'),
  
  // 项目信息（联动授权模块）
  projectName: varchar('project_name', { length: 200 }),
  projectCode: varchar('project_code', { length: 100 }),
  
  // 样机接收信息
  receiveMethod: sampleReceiveMethodEnum('receive_method'),
  receiverName: varchar('receiver_name', { length: 50 }),
  receiverPhone: varchar('receiver_phone', { length: 20 }),
  
  // 存放信息
  storageLocationType: varchar('storage_location_type', { length: 20 }), // our_company / their_company
  storageAddress: varchar('storage_address', { length: 500 }),
  storageRequirements: text('storage_requirements'),
  
  // 归还信息
  returnMethod: sampleReturnMethodEnum('return_method'),
  returnContactName: varchar('return_contact_name', { length: 50 }),
  returnContactPhone: varchar('return_contact_phone', { length: 20 }),
  
  // 补充说明
  supplementaryNotes: text('supplementary_notes'),
  
  // 待办追踪状态
  trackingStatus: trackingStatusEnum('tracking_status').notNull().default('not_tracked'),
  
  // 创建者
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationNoIdx: uniqueIndex('sample_applications_no_idx').on(table.applicationNo),
  statusIdx: uniqueIndex('sample_applications_status_idx').on(table.status),
}));

// ============================================
// 样机配置表
// ============================================

export const sampleConfigurations = pgTable('sample_configurations', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => sampleApplications.id, { onDelete: 'cascade' }),
  
  // 厂家信息
  manufacturerId: integer('manufacturer_id').references(() => authorizationManufacturers.id, { onDelete: 'set null' }),
  manufacturerName: varchar('manufacturer_name', { length: 200 }).notNull(),
  
  // 样机信息
  sampleName: varchar('sample_name', { length: 200 }).notNull(),
  sampleSpec: varchar('sample_spec', { length: 500 }),
  sampleConfig: text('sample_config'),
  quantity: integer('quantity').notNull().default(1),
  
  // 参数偏离
  deviationType: deviationTypeEnum('deviation_type').notNull().default('none'),
  deviationNotes: text('deviation_notes'),
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('sample_configurations_application_idx').on(table.applicationId),
}));

// ============================================
// 现场展示表
// ============================================

export const sampleDisplays = pgTable('sample_displays', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => sampleApplications.id, { onDelete: 'cascade' }),
  
  // 展示要求
  displayRequirements: text('display_requirements'),
  
  // 展示时间
  displayTime: timestamp('display_time'),
  displayLocation: varchar('display_location', { length: 500 }),
  
  // 展示负责人
  displayManagerName: varchar('display_manager_name', { length: 50 }),
  displayManagerPhone: varchar('display_manager_phone', { length: 20 }),
  
  // 展示陪同人员
  displayAccompanyingPersons: text('display_accompanying_persons'), // JSON数组
  
  // 样品到达时间
  sampleArrivalTime: timestamp('sample_arrival_time'),
  sampleConfirmTime: timestamp('sample_confirm_time'),
  sampleReceiveTime: timestamp('sample_receive_time'),
  
  // 展示完成时间
  displayCompletedTime: timestamp('display_completed_time'),
  
  // 展示结果说明
  displayResultNotes: text('display_result_notes'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('sample_displays_application_idx').on(table.applicationId),
}));

// ============================================
// 样机审核记录表
// ============================================

export const sampleReviews = pgTable('sample_reviews', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => sampleApplications.id, { onDelete: 'cascade' }),
  
  // 审核环节
  stage: sampleReviewStageEnum('stage').notNull(),
  
  // 审核人
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  reviewerName: varchar('reviewer_name', { length: 50 }).notNull(),
  
  // 审核状态
  result: reviewResultEnum('result').notNull().default('pending'),
  
  // 审核意见
  comment: text('comment'),
  
  // 审核时间
  reviewedAt: timestamp('reviewed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationStageIdx: uniqueIndex('sample_reviews_application_stage_idx').on(table.applicationId, table.stage),
}));

// ============================================
// 样机待办事项表
// ============================================

export const sampleTodos = pgTable('sample_todos', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => sampleApplications.id, { onDelete: 'cascade' }),
  
  // 待办事项
  title: varchar('title', { length: 200 }).notNull(),
  
  // 责任人
  assigneeId: integer('assignee_id').notNull().references(() => users.id),
  assigneeName: varchar('assignee_name', { length: 50 }).notNull(),
  
  // 截止时间
  deadline: timestamp('deadline'),
  
  // 事项进度
  status: todoStatusEnum('status').notNull().default('not_started'),
  
  // 备注
  notes: text('notes'),
  
  // 类型
  type: varchar('type', { length: 30 }).notNull(), // sample_submit/sample_receive/review/display/return
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('sample_todos_application_idx').on(table.applicationId),
}));

// ============================================
// 价格申请主表
// ============================================

export const priceApplications = pgTable('price_applications', {
  id: serial('id').primaryKey(),
  
  // 申请单编号
  applicationNo: varchar('application_no', { length: 50 }).notNull().unique(),
  
  // 关联授权申请（可选）
  authorizationApplicationId: integer('authorization_application_id').references(() => authorizationApplications.id, { onDelete: 'set null' }),
  
  // 关联项目
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  
  // 申请日期
  applicationDate: timestamp('application_date').notNull().defaultNow(),
  
  // 经办人信息
  handlerId: integer('handler_id').notNull().references(() => users.id),
  handlerName: varchar('handler_name', { length: 50 }).notNull(),
  handlerPhone: varchar('handler_phone', { length: 20 }),
  
  // 申请状态
  status: priceApplicationStatusEnum('status').notNull().default('draft'),
  
  // 项目信息
  projectName: varchar('project_name', { length: 200 }),
  projectCode: varchar('project_code', { length: 100 }),
  tenderOrganization: varchar('tender_organization', { length: 200 }),
  
  // 投标截止日期
  submissionDeadline: timestamp('submission_deadline'),
  
  // 价格有效期
  priceValidFrom: timestamp('price_valid_from'),
  priceValidTo: timestamp('price_valid_to'),
  
  // 备注
  notes: text('notes'),
  
  // 待办追踪状态
  trackingStatus: trackingStatusEnum('tracking_status').notNull().default('not_tracked'),
  
  // 创建者
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationNoIdx: uniqueIndex('price_applications_no_idx').on(table.applicationNo),
  statusIdx: uniqueIndex('price_applications_status_idx').on(table.status),
}));

// ============================================
// 价格申请明细表
// ============================================

export const priceApplicationItems = pgTable('price_application_items', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => priceApplications.id, { onDelete: 'cascade' }),
  
  // 厂家信息
  manufacturerId: integer('manufacturer_id').references(() => authorizationManufacturers.id, { onDelete: 'set null' }),
  manufacturerName: varchar('manufacturer_name', { length: 200 }).notNull(),
  
  // 产品信息
  productName: varchar('product_name', { length: 200 }).notNull(),
  productSpec: varchar('product_spec', { length: 500 }),
  
  // 价格信息
  unitPrice: varchar('unit_price', { length: 50 }), // 可能包含折扣等信息
  totalPrice: varchar('total_price', { length: 50 }),
  currency: varchar('currency', { length: 20 }).default('CNY'),
  
  // 数量
  quantity: integer('quantity'),
  unit: varchar('unit', { length: 20 }),
  
  // 备注
  notes: text('notes'),
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('price_application_items_application_idx').on(table.applicationId),
}));

// ============================================
// 价格审核记录表
// ============================================

export const priceReviews = pgTable('price_reviews', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => priceApplications.id, { onDelete: 'cascade' }),
  
  // 审核环节
  stage: priceReviewStageEnum('stage').notNull(),
  
  // 审核人
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  reviewerName: varchar('reviewer_name', { length: 50 }).notNull(),
  
  // 审核状态
  result: reviewResultEnum('result').notNull().default('pending'),
  
  // 审核意见
  comment: text('comment'),
  
  // 审核时间
  reviewedAt: timestamp('reviewed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationStageIdx: uniqueIndex('price_reviews_application_stage_idx').on(table.applicationId, table.stage),
}));

// ============================================
// 样机申请关系定义
// ============================================

export const sampleApplicationsRelations = relations(sampleApplications, ({ one, many }) => ({
  authorizationApplication: one(authorizationApplications, {
    fields: [sampleApplications.authorizationApplicationId],
    references: [authorizationApplications.id],
  }),
  project: one(projects, {
    fields: [sampleApplications.projectId],
    references: [projects.id],
  }),
  handler: one(users, {
    fields: [sampleApplications.handlerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [sampleApplications.createdBy],
    references: [users.id],
  }),
  configurations: many(sampleConfigurations),
  display: one(sampleDisplays),
  reviews: many(sampleReviews),
  todos: many(sampleTodos),
}));

export const sampleConfigurationsRelations = relations(sampleConfigurations, ({ one }) => ({
  application: one(sampleApplications, {
    fields: [sampleConfigurations.applicationId],
    references: [sampleApplications.id],
  }),
  manufacturer: one(authorizationManufacturers, {
    fields: [sampleConfigurations.manufacturerId],
    references: [authorizationManufacturers.id],
  }),
}));

export const sampleDisplaysRelations = relations(sampleDisplays, ({ one }) => ({
  application: one(sampleApplications, {
    fields: [sampleDisplays.applicationId],
    references: [sampleApplications.id],
  }),
}));

export const sampleReviewsRelations = relations(sampleReviews, ({ one }) => ({
  application: one(sampleApplications, {
    fields: [sampleReviews.applicationId],
    references: [sampleApplications.id],
  }),
  reviewer: one(users, {
    fields: [sampleReviews.reviewerId],
    references: [users.id],
  }),
}));

export const sampleTodosRelations = relations(sampleTodos, ({ one }) => ({
  application: one(sampleApplications, {
    fields: [sampleTodos.applicationId],
    references: [sampleApplications.id],
  }),
  assignee: one(users, {
    fields: [sampleTodos.assigneeId],
    references: [users.id],
  }),
}));

// ============================================
// 价格申请关系定义
// ============================================

export const priceApplicationsRelations = relations(priceApplications, ({ one, many }) => ({
  authorizationApplication: one(authorizationApplications, {
    fields: [priceApplications.authorizationApplicationId],
    references: [authorizationApplications.id],
  }),
  project: one(projects, {
    fields: [priceApplications.projectId],
    references: [projects.id],
  }),
  handler: one(users, {
    fields: [priceApplications.handlerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [priceApplications.createdBy],
    references: [users.id],
  }),
  items: many(priceApplicationItems),
  reviews: many(priceReviews),
}));

export const priceApplicationItemsRelations = relations(priceApplicationItems, ({ one }) => ({
  application: one(priceApplications, {
    fields: [priceApplicationItems.applicationId],
    references: [priceApplications.id],
  }),
  manufacturer: one(authorizationManufacturers, {
    fields: [priceApplicationItems.manufacturerId],
    references: [authorizationManufacturers.id],
  }),
}));

export const priceReviewsRelations = relations(priceReviews, ({ one }) => ({
  application: one(priceApplications, {
    fields: [priceReviews.applicationId],
    references: [priceApplications.id],
  }),
  reviewer: one(users, {
    fields: [priceReviews.reviewerId],
    references: [users.id],
  }),
}));

// ============================================
// 授权申请类型导出
// ============================================

export type AuthorizationApplication = typeof authorizationApplications.$inferSelect;
export type NewAuthorizationApplication = typeof authorizationApplications.$inferInsert;
export type AuthorizationManufacturer = typeof authorizationManufacturers.$inferSelect;
export type NewAuthorizationManufacturer = typeof authorizationManufacturers.$inferInsert;
export type AuthorizationQualification = typeof authorizationQualifications.$inferSelect;
export type NewAuthorizationQualification = typeof authorizationQualifications.$inferInsert;
export type AuthorizationSupportingDoc = typeof authorizationSupportingDocs.$inferSelect;
export type NewAuthorizationSupportingDoc = typeof authorizationSupportingDocs.$inferInsert;
export type AuthorizationDelivery = typeof authorizationDeliveries.$inferSelect;
export type NewAuthorizationDelivery = typeof authorizationDeliveries.$inferInsert;
export type AuthorizationReview = typeof authorizationReviews.$inferSelect;
export type NewAuthorizationReview = typeof authorizationReviews.$inferInsert;
export type AuthorizationTodo = typeof authorizationTodos.$inferSelect;
export type NewAuthorizationTodo = typeof authorizationTodos.$inferInsert;
export type AuthorizationStatus = typeof authorizationStatusEnum.enumValues[number];
export type ManufacturerType = typeof manufacturerTypeEnum.enumValues[number];
export type DeviationType = typeof deviationTypeEnum.enumValues[number];
export type ReviewStage = typeof reviewStageEnum.enumValues[number];
export type ReviewResult = typeof reviewResultEnum.enumValues[number];
export type TodoStatus = typeof todoStatusEnum.enumValues[number];
export type TrackingStatus = typeof trackingStatusEnum.enumValues[number];

// ============================================
// 样机申请类型导出
// ============================================

export type SampleApplication = typeof sampleApplications.$inferSelect;
export type NewSampleApplication = typeof sampleApplications.$inferInsert;
export type SampleConfiguration = typeof sampleConfigurations.$inferSelect;
export type NewSampleConfiguration = typeof sampleConfigurations.$inferInsert;
export type SampleDisplay = typeof sampleDisplays.$inferSelect;
export type NewSampleDisplay = typeof sampleDisplays.$inferInsert;
export type SampleReview = typeof sampleReviews.$inferSelect;
export type NewSampleReview = typeof sampleReviews.$inferInsert;
export type SampleTodo = typeof sampleTodos.$inferSelect;
export type NewSampleTodo = typeof sampleTodos.$inferInsert;
export type SampleApplicationStatus = typeof sampleApplicationStatusEnum.enumValues[number];
export type SampleReceiveMethod = typeof sampleReceiveMethodEnum.enumValues[number];
export type SampleReturnMethod = typeof sampleReturnMethodEnum.enumValues[number];
export type SampleReviewStage = typeof sampleReviewStageEnum.enumValues[number];

// ============================================
// 价格申请类型导出
// ============================================

export type PriceApplication = typeof priceApplications.$inferSelect;
export type NewPriceApplication = typeof priceApplications.$inferInsert;
export type PriceApplicationItem = typeof priceApplicationItems.$inferSelect;
export type NewPriceApplicationItem = typeof priceApplicationItems.$inferInsert;
export type PriceReview = typeof priceReviews.$inferSelect;
export type NewPriceReview = typeof priceReviews.$inferInsert;
export type PriceApplicationStatus = typeof priceApplicationStatusEnum.enumValues[number];
export type PriceReviewStage = typeof priceReviewStageEnum.enumValues[number];

// ============================================
// 友司支持申请状态枚举
// ============================================

export const partnerApplicationStatusEnum = pgEnum('partner_application_status', [
  'draft',           // 待提交
  'pending_confirm', // 待友司确认
  'confirmed',       // 友司已确认
  'material_pending', // 材料待接收
  'material_received', // 材料已接收
  'completed',       // 支持完成
  'terminated',      // 申请终止
]);

// ============================================
// 友司确认状态枚举
// ============================================

export const partnerConfirmStatusEnum = pgEnum('partner_confirm_status', [
  'confirmed',  // 已确认支持围标
  'pending',    // 待确认
  'rejected',   // 拒绝支持
]);

// ============================================
// 友司支持审核环节枚举
// ============================================

export const partnerReviewStageEnum = pgEnum('partner_review_stage', [
  'material_completeness',  // 材料完整性审核
  'material_validity',      // 材料真实性/有效性审核
  'final',                  // 最终审核
]);

// ============================================
// 友司支持申请主表
// ============================================

export const partnerApplications = pgTable('partner_applications', {
  id: serial('id').primaryKey(),
  
  // 申请单编号
  applicationNo: varchar('application_no', { length: 50 }).notNull().unique(),
  
  // 关联项目
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  
  // 申请日期
  applicationDate: timestamp('application_date').notNull().defaultNow(),
  
  // 经办人信息
  handlerId: integer('handler_id').notNull().references(() => users.id),
  handlerName: varchar('handler_name', { length: 50 }).notNull(),
  handlerPhone: varchar('handler_phone', { length: 20 }),
  
  // 申请状态
  status: partnerApplicationStatusEnum('status').notNull().default('draft'),
  
  // 材料最迟送达时间
  materialDeadline: timestamp('material_deadline'),
  
  // 材料接收确认时间
  electronicMaterialReceivedAt: timestamp('electronic_material_received_at'),
  paperMaterialReceivedAt: timestamp('paper_material_received_at'),
  allMaterialReceivedAt: timestamp('all_material_received_at'),
  
  // 短信提醒设置
  smsReminderEnabled: boolean('sms_reminder_enabled').notNull().default(false),
  
  // 待办追踪状态
  trackingStatus: trackingStatusEnum('tracking_status').notNull().default('not_tracked'),
  
  // 项目信息
  projectName: varchar('project_name', { length: 200 }),
  projectCode: varchar('project_code', { length: 100 }),
  tenderOrganization: varchar('tender_organization', { length: 200 }),
  submissionDeadline: timestamp('submission_deadline'),
  interpretationFileId: integer('interpretation_file_id'),
  biddingRequirements: text('bidding_requirements'),
  
  // 友司基础信息
  partnerCompanyId: integer('partner_company_id').references(() => companies.id, { onDelete: 'set null' }),
  partnerCompanyName: varchar('partner_company_name', { length: 200 }).notNull(),
  partnerContactPerson: varchar('partner_contact_person', { length: 50 }),
  partnerContactPhone: varchar('partner_contact_phone', { length: 20 }),
  
  // 法定代表人信息
  legalRepName: varchar('legal_rep_name', { length: 50 }),
  legalRepIdCardProvided: boolean('legal_rep_id_card_provided').default(false),
  legalRepIdCardType: varchar('legal_rep_id_card_type', { length: 20 }), // electronic/paper/both
  
  // 投标代理人信息
  bidAgentName: varchar('bid_agent_name', { length: 50 }),
  bidAgentIdCardProvided: boolean('bid_agent_id_card_provided').default(false),
  bidAgentIdCardType: varchar('bid_agent_id_card_type', { length: 20 }),
  bidAgentPhone: varchar('bid_agent_phone', { length: 20 }),
  bidAgentWechat: varchar('bid_agent_wechat', { length: 50 }),
  
  // 友司对接人信息
  partnerLiaisonName: varchar('partner_liaison_name', { length: 50 }),
  partnerLiaisonPhone: varchar('partner_liaison_phone', { length: 20 }),
  partnerLiaisonWechat: varchar('partner_liaison_wechat', { length: 50 }),
  
  // 友司确认状态
  partnerConfirmStatus: partnerConfirmStatusEnum('partner_confirm_status').notNull().default('pending'),
  partnerConfirmedAt: timestamp('partner_confirmed_at'),
  
  // 材料接收信息
  materialReceiverName: varchar('material_receiver_name', { length: 50 }),
  materialReceiverPhone: varchar('material_receiver_phone', { length: 20 }),
  electronicReceiveAddress: varchar('electronic_receive_address', { length: 200 }),
  paperReceiveAddress: varchar('paper_receive_address', { length: 500 }),
  materialAcceptanceStatus: varchar('material_acceptance_status', { length: 50 }), // complete/incomplete/invalid
  materialAcceptanceNotes: text('material_acceptance_notes'),
  
  // 申请总结
  applicationSummary: text('application_summary'),
  
  // 补充说明
  notes: text('notes'),
  
  // 创建者
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationNoIdx: uniqueIndex('partner_applications_no_idx').on(table.applicationNo),
  statusIdx: uniqueIndex('partner_applications_status_idx').on(table.status),
}));

// ============================================
// 友司材料表
// ============================================

export const partnerMaterials = pgTable('partner_materials', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => partnerApplications.id, { onDelete: 'cascade' }),
  
  // 材料类别
  category: varchar('category', { length: 50 }).notNull(), // basic/qualification/performance/personnel/other
  materialName: varchar('material_name', { length: 200 }).notNull(),
  
  // 是否提供
  isProvided: boolean('is_provided').notNull().default(false),
  
  // 提交方式
  submitType: varchar('submit_type', { length: 20 }), // electronic/paper/both
  
  // 材料备注
  notes: text('notes'),
  
  // 附件
  fileId: integer('file_id').references(() => files.id, { onDelete: 'set null' }),
  fileUrl: varchar('file_url', { length: 500 }),
  
  // 确认状态
  isConfirmed: boolean('is_confirmed').notNull().default(false),
  confirmedAt: timestamp('confirmed_at'),
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('partner_materials_application_idx').on(table.applicationId),
}));

// ============================================
// 友司费用表
// ============================================

export const partnerFees = pgTable('partner_fees', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => partnerApplications.id, { onDelete: 'cascade' }),
  
  // 费用项目
  feeType: varchar('fee_type', { length: 50 }).notNull(), // base/agent/accommodation/other
  feeName: varchar('fee_name', { length: 100 }).notNull(),
  
  // 默认费用标准
  defaultAmount: varchar('default_amount', { length: 50 }),
  
  // 实际费用金额
  actualAmount: varchar('actual_amount', { length: 50 }).notNull(),
  
  // 费用说明
  notes: text('notes'),
  
  // 支付状态
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('unpaid'), // unpaid/paid
  paidAt: timestamp('paid_at'),
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('partner_fees_application_idx').on(table.applicationId),
}));

// ============================================
// 友司审核记录表
// ============================================

export const partnerReviews = pgTable('partner_reviews', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => partnerApplications.id, { onDelete: 'cascade' }),
  
  // 审核环节
  stage: partnerReviewStageEnum('stage').notNull(),
  
  // 审核人
  reviewerId: integer('reviewer_id').notNull().references(() => users.id),
  reviewerName: varchar('reviewer_name', { length: 50 }).notNull(),
  
  // 审核状态
  result: reviewResultEnum('result').notNull().default('pending'),
  
  // 审核意见
  comment: text('comment'),
  
  // 审核时间
  reviewedAt: timestamp('reviewed_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationStageIdx: uniqueIndex('partner_reviews_application_stage_idx').on(table.applicationId, table.stage),
}));

// ============================================
// 友司待办事项表
// ============================================

export const partnerTodos = pgTable('partner_todos', {
  id: serial('id').primaryKey(),
  applicationId: integer('application_id').notNull().references(() => partnerApplications.id, { onDelete: 'cascade' }),
  
  // 待办事项
  title: varchar('title', { length: 200 }).notNull(),
  
  // 责任人
  assigneeId: integer('assignee_id').notNull().references(() => users.id),
  assigneeName: varchar('assignee_name', { length: 50 }).notNull(),
  
  // 截止时间
  deadline: timestamp('deadline'),
  
  // 事项进度
  status: todoStatusEnum('status').notNull().default('not_started'),
  
  // 备注
  notes: text('notes'),
  
  // 类型
  type: varchar('type', { length: 30 }).notNull(), // confirm/material/review/payment/other
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  applicationIdx: uniqueIndex('partner_todos_application_idx').on(table.applicationId),
}));

// ============================================
// 友司申请关系定义
// ============================================

export const partnerApplicationsRelations = relations(partnerApplications, ({ one, many }) => ({
  project: one(projects, {
    fields: [partnerApplications.projectId],
    references: [projects.id],
  }),
  handler: one(users, {
    fields: [partnerApplications.handlerId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [partnerApplications.createdBy],
    references: [users.id],
  }),
  partnerCompany: one(companies, {
    fields: [partnerApplications.partnerCompanyId],
    references: [companies.id],
  }),
  materials: many(partnerMaterials),
  fees: many(partnerFees),
  reviews: many(partnerReviews),
  todos: many(partnerTodos),
}));

export const partnerMaterialsRelations = relations(partnerMaterials, ({ one }) => ({
  application: one(partnerApplications, {
    fields: [partnerMaterials.applicationId],
    references: [partnerApplications.id],
  }),
  file: one(files, {
    fields: [partnerMaterials.fileId],
    references: [files.id],
  }),
}));

export const partnerFeesRelations = relations(partnerFees, ({ one }) => ({
  application: one(partnerApplications, {
    fields: [partnerFees.applicationId],
    references: [partnerApplications.id],
  }),
}));

export const partnerReviewsRelations = relations(partnerReviews, ({ one }) => ({
  application: one(partnerApplications, {
    fields: [partnerReviews.applicationId],
    references: [partnerApplications.id],
  }),
  reviewer: one(users, {
    fields: [partnerReviews.reviewerId],
    references: [users.id],
  }),
}));

export const partnerTodosRelations = relations(partnerTodos, ({ one }) => ({
  application: one(partnerApplications, {
    fields: [partnerTodos.applicationId],
    references: [partnerApplications.id],
  }),
  assignee: one(users, {
    fields: [partnerTodos.assigneeId],
    references: [users.id],
  }),
}));

// ============================================
// 友司支持类型导出
// ============================================

export type PartnerApplication = typeof partnerApplications.$inferSelect;
export type NewPartnerApplication = typeof partnerApplications.$inferInsert;
export type PartnerMaterial = typeof partnerMaterials.$inferSelect;
export type NewPartnerMaterial = typeof partnerMaterials.$inferInsert;
export type PartnerFee = typeof partnerFees.$inferSelect;
export type NewPartnerFee = typeof partnerFees.$inferInsert;
export type PartnerReview = typeof partnerReviews.$inferSelect;
export type NewPartnerReview = typeof partnerReviews.$inferInsert;
export type PartnerTodo = typeof partnerTodos.$inferSelect;
export type NewPartnerTodo = typeof partnerTodos.$inferInsert;
export type PartnerApplicationStatus = typeof partnerApplicationStatusEnum.enumValues[number];
export type PartnerConfirmStatus = typeof partnerConfirmStatusEnum.enumValues[number];
export type PartnerReviewStage = typeof partnerReviewStageEnum.enumValues[number];

// ============================================
// 第三阶段：招标信息抓取模块
// ============================================

// 抓取源类型枚举
export const crawlSourceTypeEnum = pgEnum('crawl_source_type', [
  'government',    // 政府采购网
  'enterprise',    // 企业招标平台
  'industry',      // 行业网站
  'custom',        // 自定义网站
]);

// 抓取任务状态枚举
export const crawlTaskStatusEnum = pgEnum('crawl_task_status', [
  'pending',       // 待执行
  'running',       // 执行中
  'completed',     // 已完成
  'failed',        // 失败
  'cancelled',     // 已取消
]);

// 招标信息状态枚举
export const tenderInfoStatusEnum = pgEnum('tender_info_status', [
  'new',           // 新发现
  'following',     // 跟踪中
  'participating', // 参与投标
  'closed',        // 已截止
  'won',           // 已中标
  'lost',          // 未中标
  'ignored',       // 已忽略
]);

// ============================================
// 抓取源配置表
// ============================================

export const crawlSources = pgTable('crawl_sources', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 200 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: crawlSourceTypeEnum('type').notNull(),
  
  // 网站信息
  baseUrl: varchar('base_url', { length: 500 }).notNull(),
  listUrl: varchar('list_url', { length: 500 }), // 列表页URL模板
  detailUrlPattern: varchar('detail_url_pattern', { length: 500 }), // 详情页URL模式
  
  // 抓取配置
  crawlConfig: text('crawl_config'), // JSON格式存储抓取规则（选择器、字段映射等）
  
  // 请求配置
  headers: text('headers'), // JSON格式存储请求头
  cookies: text('cookies'), // JSON格式存储Cookies
  proxy: varchar('proxy', { length: 200 }), // 代理配置
  
  // 定时配置
  scheduleType: varchar('schedule_type', { length: 20 }).notNull().default('manual'), // manual/cron/interval
  cronExpression: varchar('cron_expression', { length: 100 }), // Cron表达式
  intervalMinutes: integer('interval_minutes'), // 间隔分钟数
  
  // 状态
  isActive: boolean('is_active').notNull().default(true),
  lastCrawlAt: timestamp('last_crawl_at'),
  lastCrawlStatus: varchar('last_crawl_status', { length: 20 }),
  lastCrawlCount: integer('last_crawl_count').default(0),
  consecutiveFailures: integer('consecutive_failures').default(0),
  
  // 统计
  totalCrawls: integer('total_crawls').default(0),
  totalItems: integer('total_items').default(0),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: uniqueIndex('crawl_sources_code_idx').on(table.code),
  typeIdx: uniqueIndex('crawl_sources_type_idx').on(table.type),
  isActiveIdx: uniqueIndex('crawl_sources_is_active_idx').on(table.isActive),
}));

// ============================================
// 抓取任务表
// ============================================

export const crawlTasks = pgTable('crawl_tasks', {
  id: serial('id').primaryKey(),
  
  // 关联抓取源
  sourceId: integer('source_id').notNull().references(() => crawlSources.id),
  
  // 任务信息
  taskType: varchar('task_type', { length: 20 }).notNull(), // full/incremental/test
  status: crawlTaskStatusEnum('status').notNull().default('pending'),
  
  // 执行信息
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // 毫秒
  
  // 结果统计
  totalPages: integer('total_pages').default(0),
  processedPages: integer('processed_pages').default(0),
  totalItems: integer('total_items').default(0),
  newItems: integer('new_items').default(0),
  updatedItems: integer('updated_items').default(0),
  
  // 错误信息
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  
  // 日志
  logs: text('logs'), // JSON数组存储执行日志
  
  // 触发方式
  triggerType: varchar('trigger_type', { length: 20 }).notNull().default('manual'), // manual/schedule/api
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sourceIdx: uniqueIndex('crawl_tasks_source_idx').on(table.sourceId),
  statusIdx: uniqueIndex('crawl_tasks_status_idx').on(table.status),
  createdAtIdx: uniqueIndex('crawl_tasks_created_at_idx').on(table.createdAt),
}));

// ============================================
// 招标信息表
// ============================================

export const tenderInfos = pgTable('tender_infos', {
  id: serial('id').primaryKey(),
  
  // 来源信息
  sourceId: integer('source_id').references(() => crawlSources.id),
  crawlTaskId: integer('crawl_task_id').references(() => crawlTasks.id),
  sourceUrl: varchar('source_url', { length: 1000 }).notNull(),
  externalId: varchar('external_id', { length: 200 }), // 外部网站ID
  
  // 基本信息
  title: varchar('title', { length: 500 }).notNull(),
  tenderCode: varchar('tender_code', { length: 100 }), // 招标编号
  tenderType: varchar('tender_type', { length: 50 }), // 招标类型（公开招标、邀请招标等）
  
  // 招标单位信息
  tenderOrganization: varchar('tender_organization', { length: 200 }), // 招标单位
  tenderAgent: varchar('tender_agent', { length: 200 }), // 招标代理
  contactPerson: varchar('contact_person', { length: 50 }), // 联系人
  contactPhone: varchar('contact_phone', { length: 50 }), // 联系电话
  
  // 项目信息
  projectType: varchar('project_type', { length: 50 }), // 项目类型
  industry: varchar('industry', { length: 50 }), // 行业
  region: varchar('region', { length: 100 }), // 地区
  address: varchar('address', { length: 500 }), // 地址
  
  // 金额信息
  budget: varchar('budget', { length: 100 }), // 预算金额
  estimatedAmount: varchar('estimated_amount', { length: 100 }), // 估算金额
  
  // 时间节点
  publishDate: timestamp('publish_date'), // 发布日期
  registerStartDate: timestamp('register_start_date'), // 报名开始日期
  registerEndDate: timestamp('register_end_date'), // 报名截止日期
  questionDeadline: timestamp('question_deadline'), // 答疑截止日期
  submissionDeadline: timestamp('submission_deadline'), // 投标截止日期
  openBidDate: timestamp('open_bid_date'), // 开标日期
  openBidLocation: varchar('open_bid_location', { length: 500 }), // 开标地点
  
  // 内容摘要
  summary: text('summary'), // 摘要
  content: text('content'), // 详细内容（HTML）
  requirements: text('requirements'), // 资质要求
  scope: text('scope'), // 招标范围
  
  // 关联项目
  projectId: integer('project_id').references(() => projects.id),
  
  // 状态
  status: tenderInfoStatusEnum('status').notNull().default('new'),
  
  // 关注信息
  followedBy: integer('followed_by').references(() => users.id),
  followedAt: timestamp('followed_at'),
  
  // 评分（AI分析）
  matchScore: integer('match_score'), // 匹配度评分 0-100
  matchReason: text('match_reason'), // 匹配原因
  
  // 标签
  tags: text('tags'), // JSON数组存储标签
  
  // 附件
  attachments: text('attachments'), // JSON数组存储附件信息
  
  // 去重
  contentHash: varchar('content_hash', { length: 64 }), // 内容哈希
  isDuplicate: boolean('is_duplicate').default(false),
  duplicateOf: integer('duplicate_of'), // 重复的招标信息ID
  
  // 原始数据
  rawData: text('raw_data'), // JSON格式存储原始抓取数据
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  sourceIdx: uniqueIndex('tender_infos_source_idx').on(table.sourceId),
  sourceUrlIdx: uniqueIndex('tender_infos_source_url_idx').on(table.sourceUrl),
  tenderCodeIdx: uniqueIndex('tender_infos_tender_code_idx').on(table.tenderCode),
  statusIdx: uniqueIndex('tender_infos_status_idx').on(table.status),
  publishDateIdx: uniqueIndex('tender_infos_publish_date_idx').on(table.publishDate),
  contentHashIdx: uniqueIndex('tender_infos_content_hash_idx').on(table.contentHash),
}));

// ============================================
// 招标信息抓取关键词配置表
// ============================================

export const crawlKeywords = pgTable('crawl_keywords', {
  id: serial('id').primaryKey(),
  
  // 关键词信息
  keyword: varchar('keyword', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }), // 分类（行业、地区、产品等）
  
  // 匹配规则
  matchType: varchar('match_type', { length: 20 }).notNull().default('contains'), // contains/exact/regex
  priority: integer('priority').default(0), // 优先级
  
  // 状态
  isActive: boolean('is_active').notNull().default(true),
  
  // 统计
  matchCount: integer('match_count').default(0),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  keywordIdx: uniqueIndex('crawl_keywords_keyword_idx').on(table.keyword),
  categoryIdx: uniqueIndex('crawl_keywords_category_idx').on(table.category),
}));

// ============================================
// 招标信息抓取关系定义
// ============================================

export const crawlSourcesRelations = relations(crawlSources, ({ one, many }) => ({
  creator: one(users, {
    fields: [crawlSources.createdBy],
    references: [users.id],
  }),
  crawlTasks: many(crawlTasks),
  tenderInfos: many(tenderInfos),
}));

export const crawlTasksRelations = relations(crawlTasks, ({ one, many }) => ({
  source: one(crawlSources, {
    fields: [crawlTasks.sourceId],
    references: [crawlSources.id],
  }),
  creator: one(users, {
    fields: [crawlTasks.createdBy],
    references: [users.id],
  }),
  tenderInfos: many(tenderInfos),
}));

export const tenderInfosRelations = relations(tenderInfos, ({ one }) => ({
  source: one(crawlSources, {
    fields: [tenderInfos.sourceId],
    references: [crawlSources.id],
  }),
  crawlTask: one(crawlTasks, {
    fields: [tenderInfos.crawlTaskId],
    references: [crawlTasks.id],
  }),
  project: one(projects, {
    fields: [tenderInfos.projectId],
    references: [projects.id],
  }),
  follower: one(users, {
    fields: [tenderInfos.followedBy],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [tenderInfos.createdBy],
    references: [users.id],
  }),
}));

export const crawlKeywordsRelations = relations(crawlKeywords, ({ one }) => ({
  creator: one(users, {
    fields: [crawlKeywords.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// 招标信息抓取类型导出
// ============================================

export type CrawlSource = typeof crawlSources.$inferSelect;
export type NewCrawlSource = typeof crawlSources.$inferInsert;
export type CrawlTask = typeof crawlTasks.$inferSelect;
export type NewCrawlTask = typeof crawlTasks.$inferInsert;
export type TenderInfo = typeof tenderInfos.$inferSelect;
export type NewTenderInfo = typeof tenderInfos.$inferInsert;
export type CrawlKeyword = typeof crawlKeywords.$inferSelect;
export type NewCrawlKeyword = typeof crawlKeywords.$inferInsert;
export type CrawlSourceType = typeof crawlSourceTypeEnum.enumValues[number];
export type CrawlTaskStatus = typeof crawlTaskStatusEnum.enumValues[number];
export type TenderInfoStatus = typeof tenderInfoStatusEnum.enumValues[number];

// ============================================
// 第三阶段：电子签章模块
// ============================================

// 签章服务提供商枚举
export const sealProviderEnum = pgEnum('seal_provider', [
  'fadada',        // 法大大
  'esign',         // e签宝
  'qiyuesuo',      // 契约锁
  'shujubao',      // 数字宝
  'other',         // 其他
]);

// 签章类型枚举
export const sealTypeEnum = pgEnum('seal_type', [
  'company',       // 企业公章
  'contract',      // 合同章
  'finance',       // 财务章
  'legal_person',  // 法人章
  'personal',      // 个人签章
]);

// 签章状态枚举
export const sealStatusEnum = pgEnum('seal_status', [
  'active',        // 有效
  'expired',       // 已过期
  'revoked',       // 已吊销
  'pending',       // 待激活
]);

// 签署任务状态枚举
export const signTaskStatusEnum = pgEnum('sign_task_status', [
  'draft',         // 草稿
  'pending',       // 待签署
  'signing',       // 签署中
  'completed',     // 已完成
  'rejected',      // 已拒绝
  'expired',       // 已过期
  'cancelled',     // 已取消
]);

// 签署者状态枚举
export const signerStatusEnum = pgEnum('signer_status', [
  'pending',       // 待签署
  'signed',        // 已签署
  'rejected',      // 已拒绝
  'expired',       // 已过期
]);

// ============================================
// 电子签章配置表
// ============================================

export const sealConfigs = pgTable('seal_configs', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 200 }).notNull(),
  provider: sealProviderEnum('provider').notNull(),
  
  // API配置
  apiUrl: varchar('api_url', { length: 500 }).notNull(),
  appId: varchar('app_id', { length: 200 }).notNull(),
  appSecret: varchar('app_secret', { length: 500 }).notNull(), // 加密存储
  
  // 企业信息
  companyId: integer('company_id').notNull().references(() => companies.id),
  enterpriseId: varchar('enterprise_id', { length: 200 }), // 第三方企业ID
  enterpriseName: varchar('enterprise_name', { length: 200 }),
  creditCode: varchar('credit_code', { length: 50 }), // 统一社会信用代码
  
  // 配置项
  config: text('config'), // JSON格式存储其他配置
  
  // 状态
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').default(false),
  
  // 验证
  isVerified: boolean('is_verified').default(false),
  verifiedAt: timestamp('verified_at'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  providerIdx: uniqueIndex('seal_configs_provider_idx').on(table.provider),
  companyIdIdx: uniqueIndex('seal_configs_company_idx').on(table.companyId),
}));

// ============================================
// 电子印章表
// ============================================

export const seals = pgTable('seals', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 200 }).notNull(),
  type: sealTypeEnum('type').notNull(),
  
  // 关联配置
  configId: integer('config_id').notNull().references(() => sealConfigs.id),
  companyId: integer('company_id').notNull().references(() => companies.id),
  
  // 第三方信息
  externalSealId: varchar('external_seal_id', { length: 200 }), // 第三方印章ID
  sealImage: varchar('seal_image', { length: 500 }), // 印章图片URL
  
  // 有效期
  validFrom: timestamp('valid_from'),
  validTo: timestamp('valid_to'),
  status: sealStatusEnum('status').notNull().default('pending'),
  
  // 使用范围
  usageScope: text('usage_scope'), // JSON数组存储适用范围
  
  // 统计
  useCount: integer('use_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  // 授权
  authorizedUsers: text('authorized_users'), // JSON数组存储授权用户ID
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  configIdx: uniqueIndex('seals_config_idx').on(table.configId),
  companyIdx: uniqueIndex('seals_company_idx').on(table.companyId),
  typeIdx: uniqueIndex('seals_type_idx').on(table.type),
  statusIdx: uniqueIndex('seals_status_idx').on(table.status),
}));

// ============================================
// 签署任务表
// ============================================

export const signTasks = pgTable('sign_tasks', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  
  // 关联信息
  projectId: integer('project_id').references(() => projects.id),
  documentId: integer('document_id').references(() => bidDocuments.id),
  fileId: integer('file_id').references(() => files.id),
  
  // 关联配置
  configId: integer('config_id').notNull().references(() => sealConfigs.id),
  
  // 第三方信息
  externalFlowId: varchar('external_flow_id', { length: 200 }), // 第三方签署流程ID
  
  // 文档信息
  documentUrl: varchar('document_url', { length: 500 }), // 待签署文档URL
  signedDocumentUrl: varchar('signed_document_url', { length: 500 }), // 已签署文档URL
  
  // 状态
  status: signTaskStatusEnum('status').notNull().default('draft'),
  
  // 时间
  expireAt: timestamp('expire_at'), // 过期时间
  completedAt: timestamp('completed_at'),
  
  // 回调
  callbackUrl: varchar('callback_url', { length: 500 }),
  callbackStatus: varchar('callback_status', { length: 20 }),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: uniqueIndex('sign_tasks_project_idx').on(table.projectId),
  configIdx: uniqueIndex('sign_tasks_config_idx').on(table.configId),
  statusIdx: uniqueIndex('sign_tasks_status_idx').on(table.status),
  createdAtIdx: uniqueIndex('sign_tasks_created_at_idx').on(table.createdAt),
}));

// ============================================
// 签署者表
// ============================================

export const signers = pgTable('signers', {
  id: serial('id').primaryKey(),
  
  // 关联签署任务
  taskId: integer('task_id').notNull().references(() => signTasks.id, { onDelete: 'cascade' }),
  
  // 签署者信息
  signerType: varchar('signer_type', { length: 20 }).notNull(), // company/personal
  signerName: varchar('signer_name', { length: 100 }).notNull(),
  
  // 企业签署者
  companyId: integer('company_id').references(() => companies.id),
  creditCode: varchar('credit_code', { length: 50 }),
  
  // 个人签署者
  userId: integer('user_id').references(() => users.id),
  idCard: varchar('id_card', { length: 32 }), // 身份证号
  mobile: varchar('mobile', { length: 20 }), // 手机号
  email: varchar('email', { length: 100 }), // 邮箱
  
  // 第三方信息
  externalAccountId: varchar('external_account_id', { length: 200 }), // 第三方账户ID
  
  // 签章信息
  sealId: integer('seal_id').references(() => seals.id), // 使用的印章
  signPosition: text('sign_position'), // JSON格式存储签章位置
  
  // 状态
  status: signerStatusEnum('status').notNull().default('pending'),
  
  // 时间
  signedAt: timestamp('signed_at'),
  
  // 签署链接
  signUrl: varchar('sign_url', { length: 500 }), // 签署链接
  qrCodeUrl: varchar('qr_code_url', { length: 500 }), // 二维码链接
  
  // 排序
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  taskIdx: uniqueIndex('signers_task_idx').on(table.taskId),
  userIdx: uniqueIndex('signers_user_idx').on(table.userId),
  companyIdx: uniqueIndex('signers_company_idx').on(table.companyId),
  statusIdx: uniqueIndex('signers_status_idx').on(table.status),
}));

// ============================================
// 签署日志表
// ============================================

export const signLogs = pgTable('sign_logs', {
  id: serial('id').primaryKey(),
  
  taskId: integer('task_id').notNull().references(() => signTasks.id, { onDelete: 'cascade' }),
  signerId: integer('signer_id').references(() => signers.id, { onDelete: 'set null' }),
  
  // 操作信息
  action: varchar('action', { length: 50 }).notNull(), // create/sign/reject/cancel/expire
  detail: text('detail'), // JSON格式存储详细信息
  
  // IP信息
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  taskIdx: uniqueIndex('sign_logs_task_idx').on(table.taskId),
  createdAtIdx: uniqueIndex('sign_logs_created_at_idx').on(table.createdAt),
}));

// ============================================
// 电子签章关系定义
// ============================================

export const sealConfigsRelations = relations(sealConfigs, ({ one, many }) => ({
  company: one(companies, {
    fields: [sealConfigs.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [sealConfigs.createdBy],
    references: [users.id],
  }),
  seals: many(seals),
  signTasks: many(signTasks),
}));

export const sealsRelations = relations(seals, ({ one }) => ({
  config: one(sealConfigs, {
    fields: [seals.configId],
    references: [sealConfigs.id],
  }),
  company: one(companies, {
    fields: [seals.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [seals.createdBy],
    references: [users.id],
  }),
}));

export const signTasksRelations = relations(signTasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [signTasks.projectId],
    references: [projects.id],
  }),
  document: one(bidDocuments, {
    fields: [signTasks.documentId],
    references: [bidDocuments.id],
  }),
  file: one(files, {
    fields: [signTasks.fileId],
    references: [files.id],
  }),
  config: one(sealConfigs, {
    fields: [signTasks.configId],
    references: [sealConfigs.id],
  }),
  creator: one(users, {
    fields: [signTasks.createdBy],
    references: [users.id],
  }),
  signers: many(signers),
  logs: many(signLogs),
}));

export const signersRelations = relations(signers, ({ one }) => ({
  task: one(signTasks, {
    fields: [signers.taskId],
    references: [signTasks.id],
  }),
  company: one(companies, {
    fields: [signers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [signers.userId],
    references: [users.id],
  }),
  seal: one(seals, {
    fields: [signers.sealId],
    references: [seals.id],
  }),
}));

export const signLogsRelations = relations(signLogs, ({ one }) => ({
  task: one(signTasks, {
    fields: [signLogs.taskId],
    references: [signTasks.id],
  }),
  signer: one(signers, {
    fields: [signLogs.signerId],
    references: [signers.id],
  }),
}));

// ============================================
// 电子签章类型导出
// ============================================

export type SealConfig = typeof sealConfigs.$inferSelect;
export type NewSealConfig = typeof sealConfigs.$inferInsert;
export type Seal = typeof seals.$inferSelect;
export type NewSeal = typeof seals.$inferInsert;
export type SignTask = typeof signTasks.$inferSelect;
export type NewSignTask = typeof signTasks.$inferInsert;
export type Signer = typeof signers.$inferSelect;
export type NewSigner = typeof signers.$inferInsert;
export type SignLog = typeof signLogs.$inferSelect;
export type NewSignLog = typeof signLogs.$inferInsert;
export type SealProvider = typeof sealProviderEnum.enumValues[number];
export type SealType = typeof sealTypeEnum.enumValues[number];
export type SealStatus = typeof sealStatusEnum.enumValues[number];
export type SignTaskStatus = typeof signTaskStatusEnum.enumValues[number];
export type SignerStatus = typeof signerStatusEnum.enumValues[number];

// ============================================
// 第三阶段：智能报价建议模块
// ============================================

// 报价策略类型枚举
export const quoteStrategyEnum = pgEnum('quote_strategy', [
  'aggressive',    // 激进策略（低价竞标）
  'balanced',      // 平衡策略
  'conservative',  // 保守策略（注重利润）
  'custom',        // 自定义策略
]);

// 报价分析状态枚举
export const quoteAnalysisStatusEnum = pgEnum('quote_analysis_status', [
  'pending',       // 待分析
  'analyzing',     // 分析中
  'completed',     // 已完成
  'failed',        // 失败
]);

// ============================================
// 报价分析请求表
// ============================================

export const quoteAnalysisRequests = pgTable('quote_analysis_requests', {
  id: serial('id').primaryKey(),
  
  // 关联项目
  projectId: integer('project_id').references(() => projects.id),
  
  // 基本信息
  projectName: varchar('project_name', { length: 200 }).notNull(),
  tenderCode: varchar('tender_code', { length: 100 }),
  tenderOrganization: varchar('tender_organization', { length: 200 }),
  
  // 项目类型和行业
  projectType: varchar('project_type', { length: 50 }),
  industry: varchar('industry', { length: 50 }),
  region: varchar('region', { length: 100 }),
  
  // 预算信息
  budget: varchar('budget', { length: 100 }), // 项目预算
  estimatedCost: varchar('estimated_cost', { length: 100 }), // 估算成本
  
  // 评分方法
  scoringMethod: varchar('scoring_method', { length: 50 }), // 评分方法
  priceWeight: integer('price_weight'), // 报价权重（百分比）
  
  // 竞争对手信息
  knownCompetitors: text('known_competitors'), // JSON数组存储已知竞争对手
  
  // 策略选择
  strategy: quoteStrategyEnum('strategy').notNull().default('balanced'),
  
  // 分析状态
  status: quoteAnalysisStatusEnum('status').notNull().default('pending'),
  
  // 分析结果
  analysisResult: text('analysis_result'), // JSON格式存储分析结果
  
  // 建议报价
  suggestedQuote: varchar('suggested_quote', { length: 100 }), // 建议报价
  suggestedQuoteRange: varchar('suggested_quote_range', { length: 100 }), // 建议报价范围
  confidenceLevel: integer('confidence_level'), // 置信度 0-100
  
  // 分析说明
  analysisNotes: text('analysis_notes'), // 分析说明
  riskAssessment: text('risk_assessment'), // 风险评估
  
  // 时间
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: uniqueIndex('quote_analysis_project_idx').on(table.projectId),
  statusIdx: uniqueIndex('quote_analysis_status_idx').on(table.status),
  createdAtIdx: uniqueIndex('quote_analysis_created_at_idx').on(table.createdAt),
}));

// ============================================
// 报价因素分析表
// ============================================

export const quoteFactors = pgTable('quote_factors', {
  id: serial('id').primaryKey(),
  
  requestId: integer('request_id').notNull().references(() => quoteAnalysisRequests.id, { onDelete: 'cascade' }),
  
  // 因素信息
  factorName: varchar('factor_name', { length: 100 }).notNull(),
  factorType: varchar('factor_type', { length: 50 }).notNull(), // cost/market/competition/risk
  
  // 权重和评分
  weight: integer('weight').notNull(), // 权重
  score: integer('score'), // 评分 0-100
  
  // 影响分析
  impactDirection: varchar('impact_direction', { length: 20 }), // positive/negative/neutral
  impactValue: varchar('impact_value', { length: 50 }), // 影响金额/比例
  
  // 说明
  description: text('description'),
  suggestion: text('suggestion'),
  
  // 数据来源
  dataSource: varchar('data_source', { length: 50 }), // historical/market/ai_analysis
  
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  requestIdx: uniqueIndex('quote_factors_request_idx').on(table.requestId),
}));

// ============================================
// 竞争对手报价预测表
// ============================================

export const competitorQuotePredictions = pgTable('competitor_quote_predictions', {
  id: serial('id').primaryKey(),
  
  requestId: integer('request_id').notNull().references(() => quoteAnalysisRequests.id, { onDelete: 'cascade' }),
  competitorId: integer('competitor_id').references(() => competitors.id),
  
  // 竞争对手信息
  competitorName: varchar('competitor_name', { length: 200 }).notNull(),
  
  // 预测报价
  predictedQuote: varchar('predicted_quote', { length: 100 }), // 预测报价
  predictedQuoteRange: varchar('predicted_quote_range', { length: 100 }), // 预测报价范围
  
  // 置信度
  confidence: integer('confidence'), // 置信度 0-100
  
  // 分析依据
  basis: text('basis'), // JSON格式存储分析依据
  
  // 历史数据
  historicalWinRate: integer('historical_win_rate'), // 历史中标率
  avgQuoteDeviation: varchar('avg_quote_deviation', { length: 50 }), // 平均报价偏差
  
  // 预测说明
  notes: text('notes'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  requestIdx: uniqueIndex('competitor_predictions_request_idx').on(table.requestId),
}));

// ============================================
// 报价方案表
// ============================================

export const quoteSchemes = pgTable('quote_schemes', {
  id: serial('id').primaryKey(),
  
  requestId: integer('request_id').notNull().references(() => quoteAnalysisRequests.id),
  
  // 方案信息
  schemeName: varchar('scheme_name', { length: 200 }).notNull(),
  schemeType: varchar('scheme_type', { length: 50 }).notNull(), // recommended/aggressive/conservative/custom
  
  // 报价
  quoteAmount: varchar('quote_amount', { length: 100 }).notNull(),
  
  // 预期收益
  expectedProfit: varchar('expected_profit', { length: 100 }), // 预期利润
  profitRate: varchar('profit_rate', { length: 20 }), // 利润率
  
  // 中标概率
  winProbability: integer('win_probability'), // 中标概率 0-100
  
  // 风险评估
  riskLevel: varchar('risk_level', { length: 20 }), // low/medium/high
  riskFactors: text('risk_factors'), // JSON数组存储风险因素
  
  // 方案说明
  description: text('description'),
  pros: text('pros'), // 优势
  cons: text('cons'), // 劣势
  
  // 是否采纳
  isAdopted: boolean('is_adopted').default(false),
  adoptedAt: timestamp('adopted_at'),
  adoptedBy: integer('adopted_by').references(() => users.id),
  
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  requestIdx: uniqueIndex('quote_schemes_request_idx').on(table.requestId),
  isAdoptedIdx: uniqueIndex('quote_schemes_is_adopted_idx').on(table.isAdopted),
}));

// ============================================
// 报价历史对比表
// ============================================

export const quoteHistoryComparisons = pgTable('quote_history_comparisons', {
  id: serial('id').primaryKey(),
  
  requestId: integer('request_id').notNull().references(() => quoteAnalysisRequests.id, { onDelete: 'cascade' }),
  historicalQuoteId: integer('historical_quote_id').references(() => historicalQuotes.id),
  
  // 历史项目信息
  historicalProjectName: varchar('historical_project_name', { length: 200 }).notNull(),
  historicalProjectType: varchar('historical_project_type', { length: 50 }),
  historicalIndustry: varchar('historical_industry', { length: 50 }),
  historicalRegion: varchar('historical_region', { length: 100 }),
  
  // 相似度
  similarity: integer('similarity'), // 相似度 0-100
  
  // 报价信息
  historicalBudget: varchar('historical_budget', { length: 100 }),
  historicalWinningQuote: varchar('historical_winning_quote', { length: 100 }),
  historicalOurQuote: varchar('historical_our_quote', { length: 100 }),
  historicalResult: varchar('historical_result', { length: 20 }),
  
  // 参考价值
  referenceValue: text('reference_value'), // 参考价值说明
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  requestIdx: uniqueIndex('quote_history_request_idx').on(table.requestId),
}));

// ============================================
// 智能报价关系定义
// ============================================

export const quoteAnalysisRequestsRelations = relations(quoteAnalysisRequests, ({ one, many }) => ({
  project: one(projects, {
    fields: [quoteAnalysisRequests.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [quoteAnalysisRequests.createdBy],
    references: [users.id],
  }),
  factors: many(quoteFactors),
  competitorPredictions: many(competitorQuotePredictions),
  schemes: many(quoteSchemes),
  historyComparisons: many(quoteHistoryComparisons),
}));

export const quoteFactorsRelations = relations(quoteFactors, ({ one }) => ({
  request: one(quoteAnalysisRequests, {
    fields: [quoteFactors.requestId],
    references: [quoteAnalysisRequests.id],
  }),
}));

export const competitorQuotePredictionsRelations = relations(competitorQuotePredictions, ({ one }) => ({
  request: one(quoteAnalysisRequests, {
    fields: [competitorQuotePredictions.requestId],
    references: [quoteAnalysisRequests.id],
  }),
  competitor: one(competitors, {
    fields: [competitorQuotePredictions.competitorId],
    references: [competitors.id],
  }),
}));

export const quoteSchemesRelations = relations(quoteSchemes, ({ one }) => ({
  request: one(quoteAnalysisRequests, {
    fields: [quoteSchemes.requestId],
    references: [quoteAnalysisRequests.id],
  }),
  adopter: one(users, {
    fields: [quoteSchemes.adoptedBy],
    references: [users.id],
  }),
}));

export const quoteHistoryComparisonsRelations = relations(quoteHistoryComparisons, ({ one }) => ({
  request: one(quoteAnalysisRequests, {
    fields: [quoteHistoryComparisons.requestId],
    references: [quoteAnalysisRequests.id],
  }),
  historicalQuote: one(historicalQuotes, {
    fields: [quoteHistoryComparisons.historicalQuoteId],
    references: [historicalQuotes.id],
  }),
}));

// ============================================
// 智能报价类型导出
// ============================================

export type QuoteAnalysisRequest = typeof quoteAnalysisRequests.$inferSelect;
export type NewQuoteAnalysisRequest = typeof quoteAnalysisRequests.$inferInsert;
export type QuoteFactor = typeof quoteFactors.$inferSelect;
export type NewQuoteFactor = typeof quoteFactors.$inferInsert;
export type CompetitorQuotePrediction = typeof competitorQuotePredictions.$inferSelect;
export type NewCompetitorQuotePrediction = typeof competitorQuotePredictions.$inferInsert;
export type QuoteScheme = typeof quoteSchemes.$inferSelect;
export type NewQuoteScheme = typeof quoteSchemes.$inferInsert;
export type QuoteHistoryComparison = typeof quoteHistoryComparisons.$inferSelect;
export type NewQuoteHistoryComparison = typeof quoteHistoryComparisons.$inferInsert;
export type QuoteStrategy = typeof quoteStrategyEnum.enumValues[number];
export type QuoteAnalysisStatus = typeof quoteAnalysisStatusEnum.enumValues[number];

// ============================================
// 标书归档类型导出
// ============================================

export type BidArchive = typeof bidArchives.$inferSelect;
export type NewBidArchive = typeof bidArchives.$inferInsert;
export type BidArchiveDocument = typeof bidArchiveDocuments.$inferSelect;
export type NewBidArchiveDocument = typeof bidArchiveDocuments.$inferInsert;
export type BidArchiveFile = typeof bidArchiveFiles.$inferSelect;
export type NewBidArchiveFile = typeof bidArchiveFiles.$inferInsert;
export type ArchiveType = typeof archiveTypeEnum.enumValues[number];
export type BidResult = typeof bidResultEnum.enumValues[number];
export type ArchiveStatus = typeof archiveStatusEnum.enumValues[number];;

// ============================================
// 去投标模块
// ============================================

// 投标人员身份类型枚举
export const bidderIdentityEnum = pgEnum('bidder_identity', [
  'agent',              // 代理人（需授权委托书）
  'legal_representative', // 法定代表人
]);

// 出行方式枚举
export const travelModeEnum = pgEnum('travel_mode', [
  'together',           // 一起去（到现场后分开）
  'separate',           // 分开去
]);

// 去投标状态枚举
export const bidAttendanceStatusEnum = pgEnum('bid_attendance_status', [
  'pending',      // 待出发
  'in_progress',  // 进行中
  'submitted',    // 已投标
  'completed',    // 已完成
  'cancelled',    // 已取消
]);

// ============================================
// 去投标主表
// ============================================

export const bidAttendances = pgTable('bid_attendances', {
  id: serial('id').primaryKey(),
  
  // 项目信息
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  projectName: varchar('project_name', { length: 200 }).notNull(),
  projectCode: varchar('project_code', { length: 50 }),
  
  // 投标时间
  bidDate: timestamp('bid_date'), // 投标日期
  bidDeadline: timestamp('bid_deadline'), // 截标时间
  
  // 投标地点
  bidLocation: varchar('bid_location', { length: 500 }), // 投标地点
  bidLocationDetail: text('bid_location_detail'), // 详细地址
  
  // 出行方式
  travelMode: travelModeEnum('travel_mode').notNull().default('together'),
  
  // 集合信息（一起去时有效）
  meetingPoint: varchar('meeting_point', { length: 500 }), // 集合地点
  meetingTime: timestamp('meeting_time'), // 集合时间
  
  // 交通方式
  transportMode: varchar('transport_mode', { length: 50 }), // 交通方式：自驾/打车/公共交通
  transportRemarks: text('transport_remarks'), // 交通备注
  
  // 需要携带材料
  documentsNeeded: text('documents_needed'), // 需携带的材料（JSON数组）
  
  // 特殊说明
  specialInstructions: text('special_instructions'), // 特殊说明
  
  // 状态
  status: bidAttendanceStatusEnum('status').notNull().default('pending'),
  completedAt: timestamp('completed_at'),
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 投标人员表
// ============================================

export const bidAttendees = pgTable('bid_attendees', {
  id: serial('id').primaryKey(),
  
  // 关联去投标记录
  attendanceId: integer('attendance_id').notNull().references(() => bidAttendances.id, { onDelete: 'cascade' }),
  
  // 人员信息
  userId: integer('user_id').references(() => users.id), // 关联系统用户
  name: varchar('name', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  idCardNo: varchar('id_card_no', { length: 20 }), // 身份证号
  
  // 身份类型
  identity: bidderIdentityEnum('identity').notNull().default('agent'),
  
  // 代理人特有信息
  authorizationLetter: boolean('authorization_letter').default(false), // 是否有授权委托书
  authorizationLetterUrl: varchar('authorization_letter_url', { length: 500 }), // 授权委托书URL
  
  // 法定代表人特有信息
  legalRepCertificate: boolean('legal_rep_certificate').default(false), // 是否有法人身份证明
  
  // 身份证信息
  idCardFrontUrl: varchar('id_card_front_url', { length: 500 }), // 身份证正面
  idCardBackUrl: varchar('id_card_back_url', { length: 500 }), // 身份证反面
  idCardProvided: boolean('id_card_provided').default(false), // 身份证是否已提供
  
  // 出行方式（分开去时有效）
  separateTravelMode: varchar('separate_travel_mode', { length: 50 }), // 单独出行方式
  separateMeetingPoint: varchar('separate_meeting_point', { length: 500 }), // 单独集合地点
  separateMeetingTime: timestamp('separate_meeting_time'), // 单独集合时间
  
  // 备注
  remarks: text('remarks'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 去投标关系定义
// ============================================

export const bidAttendancesRelations = relations(bidAttendances, ({ one, many }) => ({
  project: one(projects, {
    fields: [bidAttendances.projectId],
    references: [projects.id],
  }),
  task: one(projectTasks, {
    fields: [bidAttendances.taskId],
    references: [projectTasks.id],
  }),
  creator: one(users, {
    fields: [bidAttendances.createdBy],
    references: [users.id],
  }),
  attendees: many(bidAttendees),
}));

export const bidAttendeesRelations = relations(bidAttendees, ({ one }) => ({
  attendance: one(bidAttendances, {
    fields: [bidAttendees.attendanceId],
    references: [bidAttendances.id],
  }),
  user: one(users, {
    fields: [bidAttendees.userId],
    references: [users.id],
  }),
}));

// ============================================
// 去投标类型导出
// ============================================

export type BidAttendance = typeof bidAttendances.$inferSelect;
export type NewBidAttendance = typeof bidAttendances.$inferInsert;
export type BidAttendee = typeof bidAttendees.$inferSelect;
export type NewBidAttendee = typeof bidAttendees.$inferInsert;
export type BidderIdentity = typeof bidderIdentityEnum.enumValues[number];
export type TravelMode = typeof travelModeEnum.enumValues[number];
export type BidAttendanceStatus = typeof bidAttendanceStatusEnum.enumValues[number];

// ============================================
// 领取中标通知书模块
// ============================================

// 领取状态枚举
export const notificationCollectionStatusEnum = pgEnum('notification_collection_status', [
  'pending',      // 待领取
  'in_progress',  // 进行中
  'completed',    // 已领取
  'cancelled',    // 已取消
]);

// ============================================
// 领取中标通知书主表
// ============================================

export const bidNotificationCollections = pgTable('bid_notification_collections', {
  id: serial('id').primaryKey(),
  
  // 项目信息
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  projectName: varchar('project_name', { length: 200 }).notNull(),
  projectCode: varchar('project_code', { length: 50 }),
  
  // 中标信息
  bidWinDate: timestamp('bid_win_date'), // 中标日期
  publicityEndDate: timestamp('publicity_end_date'), // 公示结束日期
  notificationDeadline: timestamp('notification_deadline'), // 领取截止日期
  
  // 领取地点
  collectionLocation: varchar('collection_location', { length: 500 }), // 领取地点（政采/代理机构）
  collectionLocationDetail: text('collection_location_detail'), // 详细地址
  
  // 对接人信息
  contactPerson: varchar('contact_person', { length: 50 }), // 对接人姓名
  contactPhone: varchar('contact_phone', { length: 20 }), // 对接人电话
  
  // 领取人信息
  collectorId: integer('collector_id').references(() => users.id), // 领取人
  collectorName: varchar('collector_name', { length: 50 }),
  collectorPhone: varchar('collector_phone', { length: 20 }),
  
  // 需携带材料
  needIdCard: boolean('need_id_card').notNull().default(true), // 是否需要身份证
  needBusinessLicense: boolean('need_business_license').notNull().default(true), // 是否需要营业执照副本
  needSeal: boolean('need_seal').notNull().default(true), // 是否需要加盖公章
  otherDocuments: text('other_documents'), // 其他材料（JSON数组）
  
  // 材料准备状态
  idCardPrepared: boolean('id_card_prepared').default(false), // 身份证已准备
  businessLicensePrepared: boolean('business_license_prepared').default(false), // 营业执照已准备
  otherDocumentsPrepared: boolean('other_documents_prepared').default(false), // 其他材料已准备
  
  // 领取状态
  status: notificationCollectionStatusEnum('status').notNull().default('pending'),
  collectedAt: timestamp('collected_at'), // 实际领取时间
  
  // 备注
  remarks: text('remarks'),
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 领取中标通知书关系定义
// ============================================

export const bidNotificationCollectionsRelations = relations(bidNotificationCollections, ({ one }) => ({
  project: one(projects, {
    fields: [bidNotificationCollections.projectId],
    references: [projects.id],
  }),
  collector: one(users, {
    fields: [bidNotificationCollections.collectorId],
    references: [users.id],
  }),
  task: one(projectTasks, {
    fields: [bidNotificationCollections.taskId],
    references: [projectTasks.id],
  }),
  creator: one(users, {
    fields: [bidNotificationCollections.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// 领取中标通知书类型导出
// ============================================

export type BidNotificationCollection = typeof bidNotificationCollections.$inferSelect;
export type NewBidNotificationCollection = typeof bidNotificationCollections.$inferInsert;
export type NotificationCollectionStatus = typeof notificationCollectionStatusEnum.enumValues[number];

// ============================================
// 履约保证金模块
// ============================================

// 履约保证金状态枚举
export const performanceBondStatusEnum = pgEnum('performance_bond_status', [
  'pending',        // 待缴纳
  'processing',     // 处理中
  'paid',           // 已缴纳
  'refunding',      // 退还中
  'refunded',       // 已退还
  'cancelled',      // 已取消
]);

// 缴纳方式枚举
export const bondPaymentMethodEnum = pgEnum('bond_payment_method', [
  'bank_transfer',    // 银行转账
  'bank_guarantee',   // 银行保函
  'insurance',        // 保险保函
  'other',            // 其他
]);

// ============================================
// 履约保证金主表
// ============================================

export const performanceBonds = pgTable('performance_bonds', {
  id: serial('id').primaryKey(),
  
  // 项目信息
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  projectName: varchar('project_name', { length: 200 }).notNull(),
  projectCode: varchar('project_code', { length: 50 }),
  
  // 合同信息
  contractAmount: varchar('contract_amount', { length: 50 }), // 中标合同金额
  bondAmount: varchar('bond_amount', { length: 50 }).notNull(), // 履约保证金金额
  bondPercentage: varchar('bond_percentage', { length: 20 }), // 占合同金额百分比
  
  // 缴纳要求
  isRequired: boolean('is_required').notNull().default(true), // 是否需要缴纳
  requirementSource: varchar('requirement_source', { length: 500 }), // 要求来源（招标文件条款）
  paymentDeadline: timestamp('payment_deadline'), // 缴纳截止日期
  
  // 缴纳方式
  paymentMethod: bondPaymentMethodEnum('payment_method'),
  
  // 收款方信息
  payeeName: varchar('payee_name', { length: 200 }), // 收款单位
  payeeBank: varchar('payee_bank', { length: 100 }), // 开户银行
  payeeAccount: varchar('payee_account', { length: 100 }), // 银行账号
  
  // 业务经办人
  handlerId: integer('handler_id').references(() => users.id),
  handlerName: varchar('handler_name', { length: 50 }),
  handlerPhone: varchar('handler_phone', { length: 20 }),
  
  // 财务经办人
  financeHandlerId: integer('finance_handler_id').references(() => users.id),
  financeHandlerName: varchar('finance_handler_name', { length: 50 }),
  financeHandlerPhone: varchar('finance_handler_phone', { length: 20 }),
  
  // 缴纳信息
  paidAt: timestamp('paid_at'), // 实际缴纳日期
  paymentVoucher: varchar('payment_voucher', { length: 500 }), // 缴纳凭证URL
  paymentProof: varchar('payment_proof', { length: 500 }), // 缴纳证明（回单等）
  
  // 退还信息
  refundDeadline: timestamp('refund_deadline'), // 预计退还日期
  refundedAt: timestamp('refunded_at'), // 实际退还日期
  refundProof: varchar('refund_proof', { length: 500 }), // 退还证明
  
  // 风险提示
  riskWarning: text('risk_warning'), // 风险提示（不缴纳的后果）
  
  // 状态
  status: performanceBondStatusEnum('status').notNull().default('pending'),
  
  // 备注
  remarks: text('remarks'),
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 履约保证金关系定义
// ============================================

export const performanceBondsRelations = relations(performanceBonds, ({ one }) => ({
  project: one(projects, {
    fields: [performanceBonds.projectId],
    references: [projects.id],
  }),
  handler: one(users, {
    fields: [performanceBonds.handlerId],
    references: [users.id],
  }),
  financeHandler: one(users, {
    fields: [performanceBonds.financeHandlerId],
    references: [users.id],
  }),
  task: one(projectTasks, {
    fields: [performanceBonds.taskId],
    references: [projectTasks.id],
  }),
  creator: one(users, {
    fields: [performanceBonds.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// 履约保证金类型导出
// ============================================

export type PerformanceBond = typeof performanceBonds.$inferSelect;
export type NewPerformanceBond = typeof performanceBonds.$inferInsert;
export type PerformanceBondStatus = typeof performanceBondStatusEnum.enumValues[number];
export type BondPaymentMethod = typeof bondPaymentMethodEnum.enumValues[number];

// ============================================
// 签订书面合同模块
// ============================================

// 合同签订状态枚举
export const contractSigningStatusEnum = pgEnum('contract_signing_status', [
  'pending',        // 待签订
  'drafting',       // 起草中
  'reviewing',      // 审核中
  'negotiating',    // 协商中
  'signed',         // 已签订
  'overdue',        // 已逾期
  'cancelled',      // 已取消
]);

// 合同类型枚举
export const contractTypeEnum = pgEnum('contract_type', [
  'formal',         // 正式合同
  'supplementary',  // 补充合同
  'amendment',      // 变更合同
]);

// ============================================
// 合同签订主表
// ============================================

export const contractSignings = pgTable('contract_signings', {
  id: serial('id').primaryKey(),
  
  // 项目信息
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  projectName: varchar('project_name', { length: 200 }).notNull(),
  projectCode: varchar('project_code', { length: 50 }),
  
  // 合同基本信息
  contractNumber: varchar('contract_number', { length: 100 }), // 合同编号
  contractName: varchar('contract_name', { length: 200 }).notNull(), // 合同名称
  contractType: contractTypeEnum('contract_type').default('formal'), // 合同类型
  contractAmount: varchar('contract_amount', { length: 50 }), // 合同金额
  
  // 中标通知书信息
  notificationIssuedAt: timestamp('notification_issued_at'), // 中标通知书发出日期
  signingDeadline: timestamp('signing_deadline'), // 签订截止日期（30日内）
  
  // 实际签订信息
  signedAt: timestamp('signed_at'), // 实际签订日期
  contractStartDate: timestamp('contract_start_date'), // 合同开始日期
  contractEndDate: timestamp('contract_end_date'), // 合同结束日期
  
  // 甲方信息
  partyAName: varchar('party_a_name', { length: 200 }), // 甲方名称
  partyAContact: varchar('party_a_contact', { length: 50 }), // 甲方联系人
  partyAPhone: varchar('party_a_phone', { length: 20 }), // 甲方电话
  partyAAddress: varchar('party_a_address', { length: 500 }), // 甲方地址
  
  // 乙方信息（本公司）
  partyBContact: varchar('party_b_contact', { length: 50 }), // 乙方联系人
  partyBPhone: varchar('party_b_phone', { length: 20 }), // 乙方电话
  
  // 条款一致性检查
  termsConsistent: boolean('terms_consistent').default(true), // 条款是否与招标/投标文件一致
  inconsistentTerms: text('inconsistent_terms'), // 不一致条款说明
  termsModified: boolean('terms_modified').default(false), // 是否有修改条款
  modificationReason: text('modification_reason'), // 修改原因
  
  // 合同文件
  contractFile: varchar('contract_file', { length: 500 }), // 合同文件URL
  signedContractFile: varchar('signed_contract_file', { length: 500 }), // 已签订合同文件URL
  
  // 招标文件和投标文件
  bidDocumentFile: varchar('bid_document_file', { length: 500 }), // 招标文件URL
  tenderDocumentFile: varchar('tender_document_file', { length: 500 }), // 投标文件URL
  
  // 经办人信息
  handlerId: integer('handler_id').references(() => users.id),
  handlerName: varchar('handler_name', { length: 50 }),
  handlerPhone: varchar('handler_phone', { length: 20 }),
  
  // 审核人信息
  reviewerId: integer('reviewer_id').references(() => users.id),
  reviewerName: varchar('reviewer_name', { length: 50 }),
  
  // 风险提示
  riskWarning: text('risk_warning'), // 风险提示（不签订的后果）
  
  // 状态
  status: contractSigningStatusEnum('status').notNull().default('pending'),
  
  // 备注
  remarks: text('remarks'),
  
  // 任务中心关联
  taskId: integer('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  
  // 创建者
  createdBy: integer('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 合同签订关系定义
// ============================================

export const contractSigningsRelations = relations(contractSignings, ({ one }) => ({
  project: one(projects, {
    fields: [contractSignings.projectId],
    references: [projects.id],
  }),
  handler: one(users, {
    fields: [contractSignings.handlerId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [contractSignings.reviewerId],
    references: [users.id],
  }),
  task: one(projectTasks, {
    fields: [contractSignings.taskId],
    references: [projectTasks.id],
  }),
  creator: one(users, {
    fields: [contractSignings.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// 合同签订类型导出
// ============================================

export type ContractSigning = typeof contractSignings.$inferSelect;
export type NewContractSigning = typeof contractSignings.$inferInsert;
export type ContractSigningStatus = typeof contractSigningStatusEnum.enumValues[number];
export type ContractType = typeof contractTypeEnum.enumValues[number];

// ============================================
// 政采对接模块导出
// ============================================

export * from './bidding-platform-schema';

// ============================================
// 招标信息订阅与预警模块
// ============================================

// 预警类型枚举
export const alertTypeEnum = pgEnum('alert_type', [
  'register_deadline',   // 报名截止
  'question_deadline',   // 答疑截止
  'submission_deadline', // 投标截止
  'open_bid',            // 开标时间
]);

// 预警渠道枚举
export const alertChannelEnum = pgEnum('alert_channel', [
  'system',          // 系统内通知
  'wechat_work',     // 企业微信
  'dingtalk',        // 钉钉
  'email',           // 邮件
]);

// 预警状态枚举
export const alertStatusEnum = pgEnum('alert_status', [
  'pending',     // 待发送
  'sent',        // 已发送
  'read',        // 已读
  'dismissed',   // 已忽略
]);

// ============================================
// 招标信息订阅表
// ============================================

export const tenderSubscriptions = pgTable('tender_subscriptions', {
  id: serial('id').primaryKey(),
  
  // 订阅名称
  name: varchar('name', { length: 100 }).notNull(),
  
  // 所属用户
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 筛选条件
  industries: text('industries'), // JSON数组存储行业（多选）
  regions: text('regions'), // JSON数组存储地区（多选，支持到区县）
  procurementMethods: text('procurement_methods'), // JSON数组存储采购方式（多选）
  keywords: text('keywords').notNull(), // JSON数组存储关键词（逗号分隔输入）
  
  // 预算区间
  budgetMin: varchar('budget_min', { length: 50 }), // 预算最小值
  budgetMax: varchar('budget_max', { length: 50 }), // 预算最大值
  
  // 项目类型
  projectTypes: text('project_types'), // JSON数组存储项目类型
  
  // 招标单位过滤
  tenderOrganizations: text('tender_organizations'), // JSON数组存储招标单位名称
  
  // 状态
  isActive: boolean('is_active').notNull().default(true),
  
  // 统计
  matchCount: integer('match_count').default(0), // 匹配到的招标信息数量
  
  // 最后匹配时间
  lastMatchAt: timestamp('last_match_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex('tender_subscriptions_user_idx').on(table.userId),
  isActiveIdx: uniqueIndex('tender_subscriptions_is_active_idx').on(table.isActive),
}));

// ============================================
// 预警设置表
// ============================================

export const alertSettings = pgTable('alert_settings', {
  id: serial('id').primaryKey(),
  
  // 所属用户
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // 预警提前时间（天数）
  registerDays: integer('register_days').notNull().default(1), // 报名截止提前天数
  questionDays: integer('question_days').notNull().default(1), // 答疑截止提前天数
  submissionDays: integer('submission_days').notNull().default(3), // 投标截止提前天数
  openBidDays: integer('open_bid_days').notNull().default(1), // 开标提前天数
  
  // 预警渠道配置
  channels: text('channels').notNull().default('["system"]'), // JSON数组存储启用的渠道
  wechatWorkWebhook: varchar('wechat_work_webhook', { length: 500 }), // 企业微信机器人Webhook
  dingtalkWebhook: varchar('dingtalk_webhook', { length: 500 }), // 钉钉机器人Webhook
  email: varchar('email', { length: 100 }), // 邮箱地址
  
  // 免打扰时段
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }), // 免打扰开始时间（HH:mm）
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }), // 免打扰结束时间（HH:mm）
  
  // 是否启用
  isEnabled: boolean('is_enabled').notNull().default(true),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex('alert_settings_user_idx').on(table.userId),
}));

// ============================================
// 预警记录表
// ============================================

export const tenderAlerts = pgTable('tender_alerts', {
  id: serial('id').primaryKey(),
  
  // 关联信息
  tenderInfoId: integer('tender_info_id').notNull().references(() => tenderInfos.id, { onDelete: 'cascade' }),
  subscriptionId: integer('subscription_id').references(() => tenderSubscriptions.id, { onDelete: 'set null' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 预警内容
  alertType: alertTypeEnum('alert_type').notNull(), // 预警类型
  alertTitle: varchar('alert_title', { length: 200 }).notNull(), // 预警标题
  alertMessage: text('alert_message').notNull(), // 预警消息内容
  
  // 时间节点
  targetTime: timestamp('target_time').notNull(), // 目标时间（如投标截止时间）
  scheduledTime: timestamp('scheduled_time').notNull(), // 计划发送时间
  sentAt: timestamp('sent_at'), // 实际发送时间
  
  // 推送渠道
  channel: alertChannelEnum('channel').notNull().default('system'), // 推送渠道
  
  // 状态
  status: alertStatusEnum('status').notNull().default('pending'), // 预警状态
  readAt: timestamp('read_at'), // 阅读时间
  
  // 错误信息
  errorMessage: text('error_message'), // 发送失败时的错误信息
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenderInfoIdx: uniqueIndex('tender_alerts_tender_info_idx').on(table.tenderInfoId),
  userIdx: uniqueIndex('tender_alerts_user_idx').on(table.userId),
  statusIdx: uniqueIndex('tender_alerts_status_idx').on(table.status),
  scheduledTimeIdx: uniqueIndex('tender_alerts_scheduled_time_idx').on(table.scheduledTime),
}));

// ============================================
// 招标信息订阅关系定义
// ============================================

export const tenderSubscriptionsRelations = relations(tenderSubscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [tenderSubscriptions.userId],
    references: [users.id],
  }),
  alerts: many(tenderAlerts),
}));

export const alertSettingsRelations = relations(alertSettings, ({ one }) => ({
  user: one(users, {
    fields: [alertSettings.userId],
    references: [users.id],
  }),
}));

export const tenderAlertsRelations = relations(tenderAlerts, ({ one }) => ({
  tenderInfo: one(tenderInfos, {
    fields: [tenderAlerts.tenderInfoId],
    references: [tenderInfos.id],
  }),
  subscription: one(tenderSubscriptions, {
    fields: [tenderAlerts.subscriptionId],
    references: [tenderSubscriptions.id],
  }),
  user: one(users, {
    fields: [tenderAlerts.userId],
    references: [users.id],
  }),
}));

// ============================================
// 招标信息订阅类型导出
// ============================================

export type TenderSubscription = typeof tenderSubscriptions.$inferSelect;
export type NewTenderSubscription = typeof tenderSubscriptions.$inferInsert;
export type AlertSetting = typeof alertSettings.$inferSelect;
export type NewAlertSetting = typeof alertSettings.$inferInsert;
export type TenderAlert = typeof tenderAlerts.$inferSelect;
export type NewTenderAlert = typeof tenderAlerts.$inferInsert;
export type AlertType = typeof alertTypeEnum.enumValues[number];
export type AlertChannel = typeof alertChannelEnum.enumValues[number];
export type AlertStatus = typeof alertStatusEnum.enumValues[number];

// ============================================
// 图片生成相关枚举
// ============================================

// 图片生成状态枚举
export const imageGenerationStatusEnum = pgEnum('image_generation_status', [
  'pending',    // 待生成
  'generating', // 生成中
  'completed',  // 已完成
  'failed',     // 失败
]);

// 图片生成类型枚举
export const imageGenerationTypeEnum = pgEnum('image_generation_type', [
  'text_to_image',     // 文生图
  'image_to_image',    // 图生图
  'batch_generation',  // 批量生成
]);

// 图片尺寸枚举
export const imageGenerationSizeEnum = pgEnum('image_generation_size', [
  '2K',   // 2K分辨率
  '4K',   // 4K分辨率
  'custom', // 自定义尺寸
]);

// 业务对象类型枚举
export const businessObjectTypeEnum = pgEnum('business_object_type', [
  'project',        // 项目
  'bid_document',   // 投标文档
  'chapter',        // 章节
  'marketing',      // 营销素材
  'other',          // 其他
]);

// ============================================
// 图片生成记录表
// ============================================

export const imageGenerations = pgTable('image_generations', {
  id: serial('id').primaryKey(),
  
  // 关联信息
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  projectName: varchar('project_name', { length: 200 }), // 项目名称（冗余）
  bidDocumentId: integer('bid_document_id').references(() => bidDocuments.id, { onDelete: 'set null' }),
  
  // 生成配置
  type: imageGenerationTypeEnum('type').notNull().default('text_to_image'),
  prompt: text('prompt').notNull(), // 提示词
  negativePrompt: text('negative_prompt'), // 反向提示词
  size: imageGenerationSizeEnum('size').notNull().default('2K'),
  customWidth: integer('custom_width'), // 自定义宽度
  customHeight: integer('custom_height'), // 自定义高度
  watermark: boolean('watermark').notNull().default(true), // 是否添加水印
  
  // 参考图片（图生图时使用）
  referenceImages: text('reference_images'), // 参考图片URL列表（JSON数组）
  
  // 生成结果
  imageUrls: text('image_urls').notNull(), // 生成的图片URL列表（JSON数组）
  imageCount: integer('image_count').notNull().default(1), // 生成的图片数量
  
  // 业务关联
  businessObjectType: businessObjectTypeEnum('business_object_type'),
  businessObjectId: integer('business_object_id'), // 业务对象ID
  usage: varchar('usage', { length: 100 }), // 用途说明（如：文档封面、插图等）
  
  // 状态信息
  status: imageGenerationStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'), // 错误信息
  
  // 创建者
  createdBy: integer('created_by').notNull().references(() => users.id),
  
  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('image_generations_project_idx').on(table.projectId),
  bidDocumentIdx: index('image_generations_bid_document_idx').on(table.bidDocumentId),
  statusIdx: index('image_generations_status_idx').on(table.status),
  businessObjectIdx: index('image_generations_business_object_idx').on(table.businessObjectType, table.businessObjectId),
  createdByIdx: index('image_generations_created_by_idx').on(table.createdBy),
  createdAtIdx: index('image_generations_created_at_idx').on(table.createdAt),
}));

// ============================================
// 图片生成关系定义
// ============================================

export const imageGenerationsRelations = relations(imageGenerations, ({ one }) => ({
  project: one(projects, {
    fields: [imageGenerations.projectId],
    references: [projects.id],
  }),
  bidDocument: one(bidDocuments, {
    fields: [imageGenerations.bidDocumentId],
    references: [bidDocuments.id],
  }),
  creator: one(users, {
    fields: [imageGenerations.createdBy],
    references: [users.id],
  }),
}));

// ============================================
// 图片生成类型导出
// ============================================

export type ImageGeneration = typeof imageGenerations.$inferSelect;
export type NewImageGeneration = typeof imageGenerations.$inferInsert;
export type ImageGenerationStatus = typeof imageGenerationStatusEnum.enumValues[number];
export type ImageGenerationType = typeof imageGenerationTypeEnum.enumValues[number];
export type ImageGenerationSize = typeof imageGenerationSizeEnum.enumValues[number];
export type BusinessObjectType = typeof businessObjectTypeEnum.enumValues[number];

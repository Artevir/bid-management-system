/**
 * RBAC 数据库 Schema
 * 定义角色、权限和用户-角色-权限关联
 */

import { pgTable, uuid, varchar, timestamp, boolean, jsonb, text, index, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ============================================
// 角色表
// ============================================

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  description: text('description'),
  level: varchar('level', { length: 50 }).notNull().default('normal'), // admin, manager, normal, guest
  permissions: jsonb('permissions').default([]), // 角色权限列表（快速查询）
  isSystem: boolean('is_system').default(false), // 是否系统内置角色
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  nameIdx: index('idx_roles_name').on(table.name),
  codeIdx: index('idx_roles_code').on(table.code),
  levelIdx: index('idx_roles_level').on(table.level),
  isActiveIdx: index('idx_roles_is_active').on(table.isActive),
}));

// ============================================
// 权限表
// ============================================

export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 200 }).notNull().unique(), // 格式: resource:action (如: project:create)
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // 资源类型：project, document, review, user, etc.
  action: varchar('action', { length: 50 }).notNull(), // 操作类型：create, read, update, delete, approve, etc.
  module: varchar('module', { length: 50 }).notNull(), // 模块：project, document, review, system, etc.
  isSystem: boolean('is_system').default(false), // 是否系统内置权限
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  codeIdx: index('idx_permissions_code').on(table.code),
  resourceTypeIdx: index('idx_permissions_resource_type').on(table.resourceType),
  actionIdx: index('idx_permissions_action').on(table.action),
  moduleIdx: index('idx_permissions_module').on(table.module),
  isActiveIdx: index('idx_permissions_is_active').on(table.isActive),
  resourceActionIdx: index('idx_permissions_resource_action').on(table.resourceType, table.action),
}));

// ============================================
// 用户-角色关联表
// ============================================

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // 角色过期时间（可选）
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
  userIdIdx: index('idx_user_roles_user_id').on(table.userId),
  roleIdIdx: index('idx_user_roles_role_id').on(table.roleId),
}));

// ============================================
// 角色-权限关联表
// ============================================

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  roleIdIdx: index('idx_role_permissions_role_id').on(table.roleId),
  permissionIdIdx: index('idx_role_permissions_permission_id').on(table.permissionId),
}));

// ============================================
// 数据权限表（行级权限）
// ============================================

export const dataPermissions = pgTable('data_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // 资源类型：project, document, etc.
  scope: varchar('scope', { length: 50 }).notNull(), // 权限范围：all, department, own, custom
  conditions: jsonb('conditions'), // 自定义条件（如部门ID列表）
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  roleIdIdx: index('idx_data_permissions_role_id').on(table.roleId),
  resourceTypeIdx: index('idx_data_permissions_resource_type').on(table.resourceType),
  scopeIdx: index('idx_data_permissions_scope').on(table.scope),
}));

// ============================================
// 权限日志表（记录权限变更）
// ============================================

export const permissionLogs = pgTable('permission_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 50 }).notNull(), // grant, revoke, assign_role, etc.
  targetType: varchar('target_type', { length: 50 }).notNull(), // role, permission
  targetId: uuid('target_id').notNull(),
  details: jsonb('details'), // 详细信息
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_permission_logs_user_id').on(table.userId),
  actionIdx: index('idx_permission_logs_action').on(table.action),
  createdAtIdx: index('idx_permission_logs_created_at').on(table.createdAt),
}));

// ============================================
// 关系定义
// ============================================

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
  dataPermissions: many(dataPermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const dataPermissionsRelations = relations(dataPermissions, ({ one }) => ({
  role: one(roles, {
    fields: [dataPermissions.roleId],
    references: [roles.id],
  }),
}));

export const permissionLogsRelations = relations(permissionLogs, ({ one }) => ({
  user: one(users, {
    fields: [permissionLogs.userId],
    references: [users.id],
  }),
}));

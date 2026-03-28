/**
 * AI角色管理数据库表结构
 * 支持AI角色定义、使用统计等功能
 */

import { pgTable, serial, varchar, text, integer, timestamp, boolean, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { users } from './schema';

// ============================================
// 枚举定义
// ============================================

/** AI角色类型枚举 */
export const aiAgentRoleEnum = pgEnum('ai_agent_role', [
  'sales_director',      // 销售总监
  'presales_director',   // 售前总监
  'technical_expert',    // 技术专家
  'proposal_writer',     // 标书撰写
  'bid_reviewer',        // 投标审核
  'custom',              // 自定义
]);

/** AI角色状态枚举 */
export const aiAgentStatusEnum = pgEnum('ai_agent_status', [
  'active',      // 启用
  'inactive',    // 禁用
  'draft',       // 草稿
]);

// ============================================
// AI角色表
// ============================================

export const aiAgents = pgTable('ai_agents', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 100 }).notNull(),
  roleType: aiAgentRoleEnum('role_type').notNull().default('custom'),
  description: text('description'),
  avatar: varchar('avatar', { length: 500 }),
  
  // 提示词配置
  systemPrompt: text('system_prompt').notNull(),
  examplePrompts: jsonb('example_prompts').default([]), // 示例提示词数组
  
  // 模型配置
  modelConfig: jsonb('model_config').default({
    temperature: 0.7,
    thinking: true,
    caching: false,
  }),
  
  // 参数配置
  parameters: jsonb('parameters').default({}), // 动态参数配置
  
  // 状态
  isActive: boolean('is_active').default(true),
  useCount: integer('use_count').default(0),
  
  // 权限
  scope: varchar('scope', { length: 20 }).default('company'), // system/company/department/user
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// AI角色使用记录表
// ============================================

export const aiAgentUsage = pgTable('ai_agent_usage', {
  id: serial('id').primaryKey(),
  
  agentId: integer('agent_id').notNull().references(() => aiAgents.id),
  userId: integer('user_id').references(() => users.id),
  
  // 调用内容
  conversationHistory: text('conversation_history'), // 对话历史
  responseContent: text('response_content'), // 响应内容
  
  // 统计信息
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  latency: integer('latency').default(0), // 响应时间(ms)
  
  // 状态
  status: varchar('status', { length: 20 }).default('success'), // success/error
  errorMessage: text('error_message'),
  
  // 上下文
  context: varchar('context', { length: 100 }), // 调用上下文
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ============================================
// 类型导出
// ============================================

export type AIAgent = typeof aiAgents.$inferSelect;
export type AIAgentInsert = typeof aiAgents.$inferInsert;
export type AIAgentUsage = typeof aiAgentUsage.$inferSelect;
export type AIAgentUsageInsert = typeof aiAgentUsage.$inferInsert;

/**
 * 图片生成模块数据库表结构
 * 支持图片生成记录、图片库管理等功能
 */

import { pgTable, serial, varchar, text, integer, timestamp, boolean, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { users } from './schema';

// ============================================
// 枚举定义
// ============================================

/** 图片类型枚举 */
export const imageTypeEnum = pgEnum('image_type', [
  // 组织管理类
  'org_chart',           // 组织架构图
  'dept_chart',          // 部门分工图
  'role_chart',          // 人员职责分配图
  // 逻辑梳理类
  'mind_map',            // 思维导图
  'flowchart',           // 流程图（通用）
  // 流程图专项
  'flowchart_it_ops',    // IT运维流程图
  'flowchart_bidding',   // 投标流程图
  'flowchart_project',   // 项目流程图
  'flowchart_construction', // 施工流程图
  'flowchart_approval',  // 审批流程图
  // 项目进度类
  'gantt_chart',         // 甘特图
  'milestone_chart',     // 里程碑图
  'progress_chart',      // 进度对比图
  // 技术架构类
  'topology',            // 拓扑图
  'architecture',        // 系统架构图
  'device_layout',       // 设备布局图
  // 施工专业类
  'construction_flow',   // 施工流程图
  'construction_node',   // 施工节点图
  'site_layout',         // 施工场地布置图
  // 工程设计类
  'cad_drawing',         // CAD图
  'engineering_detail',  // 工程节点详图
  // 数据可视化类
  'bar_chart',           // 柱状图
  'line_chart',          // 折线图
  'pie_chart',           // 饼图
  'heatmap',             // 热力图
  // 场景示意类
  'rendering',           // 效果图
  'installation_guide',  // 设备安装示意图
  'site_plan',           // 场地规划图
  // 其他
  'icon_set',            // 图标集合
  'diagram',             // 示意图
  'other',               // 其他
]);

/** 生成模式枚举 */
export const generateModeEnum = pgEnum('generate_mode', [
  'quick',       // 快速生成
  'precise',     // 精准生成
  'agent',       // 角色生成
]);

/** 图片状态枚举 */
export const imageStatusEnum = pgEnum('image_status', [
  'generating',  // 生成中
  'completed',   // 已完成
  'failed',      // 生成失败
  'editing',     // 编辑中
  'archived',    // 已归档
]);

/** 图片尺寸枚举 */
export const imageSizeEnum = pgEnum('image_size', [
  '2K',          // 2K分辨率
  '4K',          // 4K分辨率
  'A4_LANDSCAPE', // A4横向
  'A4_PORTRAIT', // A4纵向
  'A3_LANDSCAPE', // A3横向
  'A3_PORTRAIT', // A3纵向
  'RATIO_16_9',  // 16:9
  'RATIO_9_16',  // 9:16
  'CUSTOM',      // 自定义
]);

// ============================================
// 图片记录表
// ============================================

export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  
  // 图片类型与分类
  imageType: imageTypeEnum('image_type').notNull().default('other'),
  category: varchar('category', { length: 50 }), // 分类：投标项目/图片类型/使用场景
  tags: jsonb('tags').default([]), // 标签
  
  // 生成信息
  generateMode: generateModeEnum('generate_mode').notNull().default('quick'),
  prompt: text('prompt'), // 原始提示词
  optimizedPrompt: text('optimized_prompt'), // 优化后的提示词
  agentId: integer('agent_id'), // AI角色ID（角色生成模式）
  agentName: varchar('agent_name', { length: 100 }), // AI角色名称
  
  // 图片参数
  imageSize: imageSizeEnum('image_size').default('2K'),
  customWidth: integer('custom_width'), // 自定义宽度
  customHeight: integer('custom_height'), // 自定义高度
  style: varchar('style', { length: 50 }), // 风格：简洁商务/专业技术/手绘示意
  colorScheme: varchar('color_scheme', { length: 50 }), // 配色方案
  
  // 文件信息
  fileUrl: varchar('file_url', { length: 500 }), // 图片URL
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }), // 缩略图URL
  fileSize: integer('file_size'), // 文件大小(bytes)
  format: varchar('format', { length: 10 }), // 格式：png/jpg/pdf/svg
  width: integer('width'), // 实际宽度
  height: integer('height'), // 实际高度
  
  // 状态
  status: imageStatusEnum('status').notNull().default('generating'),
  errorMessage: text('error_message'), // 错误信息
  
  // 版本管理
  version: integer('version').default(1), // 版本号
  parentImageId: integer('parent_image_id'), // 父图片ID（编辑后的版本）
  
  // 关联信息
  projectId: integer('project_id'), // 关联项目ID
  bidId: integer('bid_id'), // 关联投标ID
  
  // 统计信息
  viewCount: integer('view_count').default(0),
  downloadCount: integer('download_count').default(0),
  useCount: integer('use_count').default(0), // 使用次数
  
  // 评分与反馈
  rating: integer('rating'), // 评分 1-5
  feedback: text('feedback'), // 用户反馈
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 图片分类表
// ============================================

export const imageCategories = pgTable('image_categories', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }).unique(),
  description: text('description'),
  
  // 层级结构
  parentId: integer('parent_id'), // 父分类ID
  level: integer('level').default(1), // 层级
  path: varchar('path', { length: 500 }), // 路径：如 "投标项目/流程图/IT运维"
  
  // 排序与状态
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  
  // 统计
  imageCount: integer('image_count').default(0),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 图片生成模板表
// ============================================

export const imageTemplates = pgTable('image_templates', {
  id: serial('id').primaryKey(),
  
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // 模板类型
  imageType: imageTypeEnum('image_type').notNull(),
  
  // 模板内容
  promptTemplate: text('prompt_template').notNull(), // 提示词模板
  defaultParams: jsonb('default_params').default({}), // 默认参数
  paramSchema: jsonb('param_schema').default({}), // 参数schema（用于动态表单）
  
  // 示例
  examplePrompts: jsonb('example_prompts').default([]), // 示例提示词
  exampleImages: jsonb('example_images').default([]), // 示例图片
  
  // 状态
  isPublic: boolean('is_public').default(true), // 是否公开
  isFeatured: boolean('is_featured').default(false), // 是否推荐
  useCount: integer('use_count').default(0),
  
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// 类型导出
// ============================================

export type Image = typeof images.$inferSelect;
export type ImageInsert = typeof images.$inferInsert;
export type ImageCategory = typeof imageCategories.$inferSelect;
export type ImageCategoryInsert = typeof imageCategories.$inferInsert;
export type ImageTemplate = typeof imageTemplates.$inferSelect;
export type ImageTemplateInsert = typeof imageTemplates.$inferInsert;

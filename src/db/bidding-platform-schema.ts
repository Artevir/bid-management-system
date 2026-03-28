/**
 * 政采对接模块数据库表结构
 * 包含政府采购平台、公共资源交易中心、招标代理公司等信息
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ============================================
// 枚举定义
// ============================================

// 单位类型枚举
export const platformTypeEnum = pgEnum('platform_type', [
  'provincial_official',    // 区级官方平台
  'provincial_cloud',       // 区级政府采购云平台
  'state_owned',            // 国企采购平台
  'city_center',            // 地市公共资源交易中心
  'agent_company',          // 招标代理公司
]);

// 单位状态枚举
export const platformStatusEnum = pgEnum('platform_status', [
  'active',      // 正常对接
  'inactive',    // 暂停对接
  'maintenance', // 维护中
]);

// ============================================
// 政采单位信息表
// ============================================

export const biddingPlatforms = pgTable('bidding_platforms', {
  id: serial('id').primaryKey(),
  
  // 基本信息
  name: varchar('name', { length: 200 }).notNull(),                    // 单位全称
  shortName: varchar('short_name', { length: 50 }),                    // 简称
  type: platformTypeEnum('type').notNull(),                            // 单位类型
  status: platformStatusEnum('status').default('active').notNull(),   // 对接状态
  
  // 联系信息
  address: varchar('address', { length: 500 }).notNull(),              // 详细地址
  phone: varchar('phone', { length: 100 }),                            // 联系电话
  website: varchar('website', { length: 500 }),                        // 官网链接
  
  // 百度地图坐标（纬度，经度格式存储）
  latitude: decimal('latitude', { precision: 10, scale: 6 }),          // 纬度
  longitude: decimal('longitude', { precision: 10, scale: 6 }),        // 经度
  coordinatePrecision: varchar('coordinate_precision', { length: 100 }), // 坐标精度说明
  
  // 对接配置
  apiEndpoint: varchar('api_endpoint', { length: 500 }),               // API对接地址
  supportOnlineBid: boolean('support_online_bid').default(false),      // 支持在线投标
  supportCaLogin: boolean('support_ca_login').default(false),          // 支持CA证书登录
  supportLiveStream: boolean('support_live_stream').default(false),    // 支持开标直播
  
  // 特色功能标签
  features: text('features'),  // JSON数组存储特色功能
  
  // 备注
  remarks: text('remarks'),                                            // 备注说明
  verificationSource: text('verification_source'),                     // 验证来源
  
  // 排序和统计
  sortOrder: integer('sort_order').default(0),                         // 排序权重
  bidCount: integer('bid_count').default(0),                           // 投标项目数量
  winCount: integer('win_count').default(0),                           // 中标项目数量
  
  // 抓取源联动
  crawlSourceId: integer('crawl_source_id'),                           // 关联的抓取源ID
  syncToCrawlSource: boolean('sync_to_crawl_source').default(true),    // 是否同步到抓取源
  lastSyncAt: timestamp('last_sync_at'),                               // 最后同步时间
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// 对接记录表
// ============================================

export const biddingRecords = pgTable('bidding_records', {
  id: serial('id').primaryKey(),
  
  // 关联信息
  platformId: integer('platform_id').notNull().references(() => biddingPlatforms.id),
  projectId: integer('project_id'),                                    // 关联项目ID
  
  // 对接信息
  projectName: varchar('project_name', { length: 300 }),               // 项目名称
  bidDeadline: timestamp('bid_deadline'),                              // 投标截止时间
  
  // 对接状态
  registrationStatus: varchar('registration_status', { length: 20 }),  // 报名状态
  documentStatus: varchar('document_status', { length: 20 }),          // 文件提交状态
  resultStatus: varchar('result_status', { length: 20 }),              // 结果状态
  
  // 保证金信息
  depositAmount: decimal('deposit_amount', { precision: 12, scale: 2 }), // 保证金金额
  depositStatus: varchar('deposit_status', { length: 20 }),            // 保证金状态
  
  // 备注
  remarks: text('remarks'),
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// 类型导出
// ============================================

export type BiddingPlatform = typeof biddingPlatforms.$inferSelect;
export type NewBiddingPlatform = typeof biddingPlatforms.$inferInsert;
export type PlatformType = typeof platformTypeEnum.enumValues[number];
export type PlatformStatus = typeof platformStatusEnum.enumValues[number];

export type BiddingRecord = typeof biddingRecords.$inferSelect;
export type NewBiddingRecord = typeof biddingRecords.$inferInsert;

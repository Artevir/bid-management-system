/**
 * 审校配置服务
 * 提供审校规则、审校人员、审校流程等配置管理
 */

import { db } from '@/db';
import { reviewConfigs, reviewRules, reviewTemplates, users } from '@/db/schema';
import { eq, and, desc, inArray, isNull as _isNull } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface ReviewConfigParams {
  name: string;
  description?: string;
  projectTypeId?: number;
  checkItems: CheckItemConfig[];
  reviewers: number[];
  minReviewers: number;
  requireAllApprove: boolean;
  autoAssign: boolean;
  maxDuration: number; // 最长审校时间（小时）
}

export interface CheckItemConfig {
  id: string;
  name: string;
  category: string;
  description?: string;
  required: boolean;
  weight: number;
}

export interface ReviewRuleParams {
  name: string;
  type: 'format' | 'content' | 'compliance' | 'custom';
  description?: string;
  condition: Record<string, unknown>; // 规则条件
  severity: 'error' | 'warning' | 'info';
  autoFix: boolean;
  fixSuggestion?: string;
}

export interface ReviewTemplateParams {
  name: string;
  description?: string;
  configId: number;
  ruleIds: number[];
  isDefault: boolean;
}

// ============================================
// 审校配置服务
// ============================================

/**
 * 获取所有审校配置
 */
export async function getAllConfigs() {
  const configs = await db
    .select()
    .from(reviewConfigs)
    .orderBy(desc(reviewConfigs.createdAt));

  return configs;
}

/**
 * 获取审校配置详情
 */
export async function getConfigById(configId: number) {
  const config = await db
    .select()
    .from(reviewConfigs)
    .where(eq(reviewConfigs.id, configId))
    .limit(1);

  if (config.length === 0) {
    return null;
  }

  return config[0];
}

/**
 * 创建审校配置
 */
export async function createConfig(
  params: ReviewConfigParams,
  userId: number
): Promise<number> {
  const [config] = await db
    .insert(reviewConfigs)
    .values({
      name: params.name,
      description: params.description,
      projectTypeId: params.projectTypeId,
      checkItems: JSON.stringify(params.checkItems),
      reviewers: JSON.stringify(params.reviewers),
      minReviewers: params.minReviewers,
      requireAllApprove: params.requireAllApprove,
      autoAssign: params.autoAssign,
      maxDuration: params.maxDuration,
      createdBy: userId,
    })
    .returning();

  return config.id;
}

/**
 * 更新审校配置
 */
export async function updateConfig(
  configId: number,
  params: Partial<ReviewConfigParams>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.name) updateData.name = params.name;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.projectTypeId) updateData.projectTypeId = params.projectTypeId;
  if (params.checkItems) updateData.checkItems = JSON.stringify(params.checkItems);
  if (params.reviewers) updateData.reviewers = JSON.stringify(params.reviewers);
  if (params.minReviewers !== undefined) updateData.minReviewers = params.minReviewers;
  if (params.requireAllApprove !== undefined) updateData.requireAllApprove = params.requireAllApprove;
  if (params.autoAssign !== undefined) updateData.autoAssign = params.autoAssign;
  if (params.maxDuration !== undefined) updateData.maxDuration = params.maxDuration;

  await db
    .update(reviewConfigs)
    .set(updateData)
    .where(eq(reviewConfigs.id, configId));

  return true;
}

/**
 * 删除审校配置
 */
export async function deleteConfig(configId: number): Promise<boolean> {
  await db.delete(reviewConfigs).where(eq(reviewConfigs.id, configId));
  return true;
}

/**
 * 启用/禁用审校配置
 */
export async function toggleConfigStatus(
  configId: number,
  isActive: boolean
): Promise<boolean> {
  await db
    .update(reviewConfigs)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(reviewConfigs.id, configId));

  return true;
}

// ============================================
// 审校规则服务
// ============================================

/**
 * 获取所有审校规则
 */
export async function getAllRules() {
  const rules = await db
    .select()
    .from(reviewRules)
    .orderBy(desc(reviewRules.createdAt));

  return rules;
}

/**
 * 获取规则详情
 */
export async function getRuleById(ruleId: number) {
  const rule = await db
    .select()
    .from(reviewRules)
    .where(eq(reviewRules.id, ruleId))
    .limit(1);

  return rule.length > 0 ? rule[0] : null;
}

/**
 * 创建审校规则
 */
export async function createRule(
  params: ReviewRuleParams,
  userId: number
): Promise<number> {
  const [rule] = await db
    .insert(reviewRules)
    .values({
      name: params.name,
      type: params.type,
      description: params.description,
      condition: JSON.stringify(params.condition),
      severity: params.severity,
      autoFix: params.autoFix,
      fixSuggestion: params.fixSuggestion,
      createdBy: userId,
    })
    .returning();

  return rule.id;
}

/**
 * 更新审校规则
 */
export async function updateRule(
  ruleId: number,
  params: Partial<ReviewRuleParams>
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.name) updateData.name = params.name;
  if (params.type) updateData.type = params.type;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.condition) updateData.condition = JSON.stringify(params.condition);
  if (params.severity) updateData.severity = params.severity;
  if (params.autoFix !== undefined) updateData.autoFix = params.autoFix;
  if (params.fixSuggestion !== undefined) updateData.fixSuggestion = params.fixSuggestion;

  await db.update(reviewRules).set(updateData).where(eq(reviewRules.id, ruleId));

  return true;
}

/**
 * 删除审校规则
 */
export async function deleteRule(ruleId: number): Promise<boolean> {
  await db.delete(reviewRules).where(eq(reviewRules.id, ruleId));
  return true;
}

// ============================================
// 审校模板服务
// ============================================

/**
 * 获取所有审校模板
 */
export async function getAllTemplates() {
  const templates = await db
    .select()
    .from(reviewTemplates)
    .orderBy(desc(reviewTemplates.isDefault), desc(reviewTemplates.createdAt));

  return templates;
}

/**
 * 获取模板详情
 */
export async function getTemplateById(templateId: number) {
  const template = await db
    .select()
    .from(reviewTemplates)
    .where(eq(reviewTemplates.id, templateId))
    .limit(1);

  if (template.length === 0) {
    return null;
  }

  return template[0];
}

/**
 * 创建审校模板
 */
export async function createTemplate(
  params: ReviewTemplateParams,
  userId: number
): Promise<number> {
  // 如果设置为默认模板，先取消其他默认模板
  if (params.isDefault) {
    await db
      .update(reviewTemplates)
      .set({ isDefault: false })
      .where(eq(reviewTemplates.isDefault, true));
  }

  const [template] = await db
    .insert(reviewTemplates)
    .values({
      name: params.name,
      description: params.description,
      configId: params.configId,
      ruleIds: JSON.stringify(params.ruleIds),
      isDefault: params.isDefault,
      createdBy: userId,
    })
    .returning();

  return template.id;
}

/**
 * 更新审校模板
 */
export async function updateTemplate(
  templateId: number,
  params: Partial<ReviewTemplateParams>
): Promise<boolean> {
  // 如果设置为默认模板，先取消其他默认模板
  if (params.isDefault) {
    await db
      .update(reviewTemplates)
      .set({ isDefault: false })
      .where(and(eq(reviewTemplates.isDefault, true), eq(reviewTemplates.id, templateId)));
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.name) updateData.name = params.name;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.configId) updateData.configId = params.configId;
  if (params.ruleIds) updateData.ruleIds = JSON.stringify(params.ruleIds);
  if (params.isDefault !== undefined) updateData.isDefault = params.isDefault;

  await db
    .update(reviewTemplates)
    .set(updateData)
    .where(eq(reviewTemplates.id, templateId));

  return true;
}

/**
 * 删除审校模板
 */
export async function deleteTemplate(templateId: number): Promise<boolean> {
  await db.delete(reviewTemplates).where(eq(reviewTemplates.id, templateId));
  return true;
}

/**
 * 获取默认模板
 */
export async function getDefaultTemplate() {
  const template = await db
    .select()
    .from(reviewTemplates)
    .where(eq(reviewTemplates.isDefault, true))
    .limit(1);

  return template.length > 0 ? template[0] : null;
}

// ============================================
// 审校人员管理
// ============================================

/**
 * 获取可用的审校人员列表
 */
export async function getAvailableReviewers() {
  const reviewers = await db
    .select({
      id: users.id,
      name: users.realName,
      email: users.email,
    })
    .from(users);

  return reviewers;
}

/**
 * 根据项目类型获取审校人员
 */
export async function getReviewersByProjectType(projectTypeId: number) {
  const configs = await db
    .select()
    .from(reviewConfigs)
    .where(
      and(
        eq(reviewConfigs.projectTypeId, projectTypeId),
        eq(reviewConfigs.isActive, true)
      )
    );

  if (configs.length === 0) {
    return [];
  }

  const reviewerIds = JSON.parse(configs[0].reviewers as string) as number[];
  const reviewers = await db
    .select({
      id: users.id,
      name: users.realName,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, reviewerIds));

  return reviewers;
}

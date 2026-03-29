/**
 * 审校配置管理API
 * GET: 获取配置列表或详情
 * POST: 创建配置
 * PUT: 更新配置
 * DELETE: 删除配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfig,
  deleteConfig,
  toggleConfigStatus,
  getAllRules,
  getRuleById as _getRuleById,
  createRule,
  updateRule,
  deleteRule,
  getAllTemplates,
  getTemplateById as _getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getDefaultTemplate as _getDefaultTemplate,
  getAvailableReviewers,
} from '@/lib/review/config';

// ============================================
// 获取配置列表
// ============================================

async function listConfigs(
  _request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const configs = await getAllConfigs();

    return NextResponse.json({
      configs,
      total: configs.length,
    });
  } catch (error) {
    console.error('Get review configs error:', error);
    return NextResponse.json({ error: '获取审校配置失败' }, { status: 500 });
  }
}

// ============================================
// 获取配置详情
// ============================================

async function getConfig(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const configId = parseInt(searchParams.get('configId') || '0');

    if (!configId) {
      return NextResponse.json({ error: '缺少配置ID' }, { status: 400 });
    }

    const config = await getConfigById(configId);

    if (!config) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Get review config error:', error);
    return NextResponse.json({ error: '获取审校配置失败' }, { status: 500 });
  }
}

// ============================================
// 创建配置
// ============================================

async function createConfigHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    const configId = await createConfig(body, userId);

    return NextResponse.json({
      success: true,
      message: '审校配置创建成功',
      configId,
    });
  } catch (error) {
    console.error('Create review config error:', error);
    return NextResponse.json({ error: '创建审校配置失败' }, { status: 500 });
  }
}

// ============================================
// 更新配置
// ============================================

async function updateConfigHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { configId, ...params } = body;

    if (!configId) {
      return NextResponse.json({ error: '缺少配置ID' }, { status: 400 });
    }

    await updateConfig(configId, params);

    return NextResponse.json({
      success: true,
      message: '审校配置更新成功',
    });
  } catch (error) {
    console.error('Update review config error:', error);
    return NextResponse.json({ error: '更新审校配置失败' }, { status: 500 });
  }
}

// ============================================
// 删除配置
// ============================================

async function deleteConfigHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { configId } = body;

    if (!configId) {
      return NextResponse.json({ error: '缺少配置ID' }, { status: 400 });
    }

    await deleteConfig(configId);

    return NextResponse.json({
      success: true,
      message: '审校配置删除成功',
    });
  } catch (error) {
    console.error('Delete review config error:', error);
    return NextResponse.json({ error: '删除审校配置失败' }, { status: 500 });
  }
}

// ============================================
// 切换配置状态
// ============================================

async function toggleStatusHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { configId, isActive } = body;

    if (!configId) {
      return NextResponse.json({ error: '缺少配置ID' }, { status: 400 });
    }

    await toggleConfigStatus(configId, isActive);

    return NextResponse.json({
      success: true,
      message: isActive ? '配置已启用' : '配置已禁用',
    });
  } catch (error) {
    console.error('Toggle config status error:', error);
    return NextResponse.json({ error: '切换配置状态失败' }, { status: 500 });
  }
}

// ============================================
// 规则相关
// ============================================

async function listRules(
  _request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const rules = await getAllRules();

    return NextResponse.json({
      rules,
      total: rules.length,
    });
  } catch (error) {
    console.error('Get review rules error:', error);
    return NextResponse.json({ error: '获取审校规则失败' }, { status: 500 });
  }
}

async function createRuleHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    const ruleId = await createRule(body, userId);

    return NextResponse.json({
      success: true,
      message: '审校规则创建成功',
      ruleId,
    });
  } catch (error) {
    console.error('Create review rule error:', error);
    return NextResponse.json({ error: '创建审校规则失败' }, { status: 500 });
  }
}

async function updateRuleHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { ruleId, ...params } = body;

    if (!ruleId) {
      return NextResponse.json({ error: '缺少规则ID' }, { status: 400 });
    }

    await updateRule(ruleId, params);

    return NextResponse.json({
      success: true,
      message: '审校规则更新成功',
    });
  } catch (error) {
    console.error('Update review rule error:', error);
    return NextResponse.json({ error: '更新审校规则失败' }, { status: 500 });
  }
}

async function deleteRuleHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { ruleId } = body;

    if (!ruleId) {
      return NextResponse.json({ error: '缺少规则ID' }, { status: 400 });
    }

    await deleteRule(ruleId);

    return NextResponse.json({
      success: true,
      message: '审校规则删除成功',
    });
  } catch (error) {
    console.error('Delete review rule error:', error);
    return NextResponse.json({ error: '删除审校规则失败' }, { status: 500 });
  }
}

// ============================================
// 模板相关
// ============================================

async function listTemplates(
  _request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const templates = await getAllTemplates();

    return NextResponse.json({
      templates,
      total: templates.length,
    });
  } catch (error) {
    console.error('Get review templates error:', error);
    return NextResponse.json({ error: '获取审校模板失败' }, { status: 500 });
  }
}

async function createTemplateHandler(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();

    const templateId = await createTemplate(body, userId);

    return NextResponse.json({
      success: true,
      message: '审校模板创建成功',
      templateId,
    });
  } catch (error) {
    console.error('Create review template error:', error);
    return NextResponse.json({ error: '创建审校模板失败' }, { status: 500 });
  }
}

async function updateTemplateHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { templateId, ...params } = body;

    if (!templateId) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }

    await updateTemplate(templateId, params);

    return NextResponse.json({
      success: true,
      message: '审校模板更新成功',
    });
  } catch (error) {
    console.error('Update review template error:', error);
    return NextResponse.json({ error: '更新审校模板失败' }, { status: 500 });
  }
}

async function deleteTemplateHandler(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json({ error: '缺少模板ID' }, { status: 400 });
    }

    await deleteTemplate(templateId);

    return NextResponse.json({
      success: true,
      message: '审校模板删除成功',
    });
  } catch (error) {
    console.error('Delete review template error:', error);
    return NextResponse.json({ error: '删除审校模板失败' }, { status: 500 });
  }
}

// ============================================
// 审校人员列表
// ============================================

async function listReviewers(
  _request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const reviewers = await getAvailableReviewers();

    return NextResponse.json({
      reviewers,
      total: reviewers.length,
    });
  } catch (error) {
    console.error('Get reviewers error:', error);
    return NextResponse.json({ error: '获取审校人员失败' }, { status: 500 });
  }
}

// ============================================
// 路由分发
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'config') {
    return withAuth(request, getConfig);
  }

  if (action === 'rules') {
    return withAuth(request, listRules);
  }

  if (action === 'templates') {
    return withAuth(request, listTemplates);
  }

  if (action === 'reviewers') {
    return withAuth(request, listReviewers);
  }

  return withAuth(request, listConfigs);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'config') {
    return withAuth(request, createConfigHandler);
  }

  if (action === 'rule') {
    return withAuth(request, createRuleHandler);
  }

  if (action === 'template') {
    return withAuth(request, createTemplateHandler);
  }

  if (action === 'update-config') {
    return withAuth(request, updateConfigHandler);
  }

  if (action === 'update-rule') {
    return withAuth(request, updateRuleHandler);
  }

  if (action === 'update-template') {
    return withAuth(request, updateTemplateHandler);
  }

  if (action === 'delete-config') {
    return withAuth(request, deleteConfigHandler);
  }

  if (action === 'delete-rule') {
    return withAuth(request, deleteRuleHandler);
  }

  if (action === 'delete-template') {
    return withAuth(request, deleteTemplateHandler);
  }

  if (action === 'toggle-status') {
    return withAuth(request, toggleStatusHandler);
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

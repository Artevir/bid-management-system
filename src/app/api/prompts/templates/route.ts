/**
 * 提示词模板管理API
 * 支持模板的增删改查、版本管理、参数渲染
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  promptTemplates, 
  promptCategories, 
  promptParameters, 
  promptVersions,
  promptRoleMappings,
  users,
  roles,
} from '@/db/schema';
import { eq, like, desc, asc, and, or, inArray } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取模板列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const keyword = searchParams.get('keyword');
    const roleId = searchParams.get('roleId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 构建查询条件
    const conditions = [];
    
    if (categoryId && categoryId !== 'all') {
      conditions.push(eq(promptTemplates.categoryId, parseInt(categoryId)));
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(promptTemplates.status, status as any));
    }
    
    if (keyword) {
      conditions.push(
        or(
          like(promptTemplates.name, `%${keyword}%`),
          like(promptTemplates.code, `%${keyword}%`),
          like(promptTemplates.description, `%${keyword}%`)
        )
      );
    }

    // 如果指定了角色，查询角色关联的模板
    if (roleId && roleId !== 'all') {
      const roleTemplates = await db
        .select({ templateId: promptRoleMappings.templateId })
        .from(promptRoleMappings)
        .where(and(
          eq(promptRoleMappings.roleId, parseInt(roleId)),
          eq(promptRoleMappings.isActive, true)
        ));
      
      if (roleTemplates.length > 0) {
        conditions.push(
          inArray(promptTemplates.id, roleTemplates.map(r => r.templateId))
        );
      }
    }

    // 查询模板列表
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [templates, totalResult, categories] = await Promise.all([
      db
        .select({
          id: promptTemplates.id,
          name: promptTemplates.name,
          code: promptTemplates.code,
          description: promptTemplates.description,
          categoryId: promptTemplates.categoryId,
          categoryName: promptCategories.name,
          status: promptTemplates.status,
          currentVersion: promptTemplates.currentVersion,
          modelProvider: promptTemplates.modelProvider,
          modelName: promptTemplates.modelName,
          outputFormat: promptTemplates.outputFormat,
          isSystem: promptTemplates.isSystem,
          useCount: promptTemplates.useCount,
          // AI角色字段
          isAgent: promptTemplates.isAgent,
          agentRole: promptTemplates.agentRole,
          agentAvatar: promptTemplates.agentAvatar,
          agentGreeting: promptTemplates.agentGreeting,
          agentDescription: promptTemplates.agentDescription,
          agentSkills: promptTemplates.agentSkills,
          createdAt: promptTemplates.createdAt,
          updatedAt: promptTemplates.updatedAt,
          creatorName: users.realName,
        })
        .from(promptTemplates)
        .leftJoin(promptCategories, eq(promptTemplates.categoryId, promptCategories.id))
        .leftJoin(users, eq(promptTemplates.createdBy, users.id))
        .where(whereClause)
        .orderBy(desc(promptTemplates.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      
      db
        .select({ count: promptTemplates.id })
        .from(promptTemplates)
        .where(whereClause),
      
      db
        .select()
        .from(promptCategories)
        .where(eq(promptCategories.isActive, true))
        .orderBy(asc(promptCategories.sortOrder)),
    ]);

    const total = totalResult.length;

    return NextResponse.json({
      items: templates,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      categories,
    });
  } catch (error) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json(
      { error: '获取模板列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建模板
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      code,
      description,
      categoryId,
      content,
      systemPrompt,
      modelProvider,
      modelName,
      temperature,
      maxTokens,
      outputFormat,
      parameters,
      roleIds,
      // AI角色字段
      isAgent,
      agentRole,
      agentAvatar,
      agentGreeting,
      agentDescription,
      agentSkills,
    } = body;

    // 验证必填字段
    if (!name || !code || !content) {
      return NextResponse.json(
        { error: '缺少必填字段：name, code, content' },
        { status: 400 }
      );
    }

    // 检查code是否已存在
    const existing = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.code, code))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: '模板编码已存在' },
        { status: 400 }
      );
    }

    // 创建模板
    const [template] = await db
      .insert(promptTemplates)
      .values({
        name,
        code,
        description,
        categoryId: categoryId || null,
        content,
        systemPrompt: systemPrompt || null,
        modelProvider: modelProvider || null,
        modelName: modelName || null,
        temperature: temperature || null,
        maxTokens: maxTokens || null,
        outputFormat: outputFormat || 'markdown',
        // AI角色字段
        isAgent: isAgent ?? false,
        agentRole: agentRole || null,
        agentAvatar: agentAvatar || null,
        agentGreeting: agentGreeting || null,
        agentDescription: agentDescription || null,
        agentSkills: agentSkills ? JSON.stringify(agentSkills) : null,
        // 默认值
        status: 'draft',
        currentVersion: 1,
        isSystem: false,
        isActive: true,
        useCount: 0,
        createdBy: currentUser.userId,
      })
      .returning();

    // 创建初始版本
    await db.insert(promptVersions).values({
      templateId: template.id,
      version: 1,
      name,
      content,
      systemPrompt: systemPrompt || null,
      changeLog: '初始版本',
      modelProvider: modelProvider || null,
      modelName: modelName || null,
      temperature: temperature || null,
      maxTokens: maxTokens || null,
      outputFormat: outputFormat || 'markdown',
      authorId: currentUser.userId,
    });

    // 创建参数
    if (parameters && parameters.length > 0) {
      await db.insert(promptParameters).values(
        parameters.map((p: any, index: number) => ({
          templateId: template.id,
          name: p.name,
          label: p.label,
          description: p.description || null,
          type: p.type || 'text',
          defaultValue: p.defaultValue || null,
          options: p.options ? JSON.stringify(p.options) : null,
          bindingType: p.bindingType || null,
          bindingField: p.bindingField || null,
          isRequired: p.isRequired ?? true,
          sortOrder: index,
        }))
      );
    }

    // 创建角色映射
    if (roleIds && roleIds.length > 0) {
      await db.insert(promptRoleMappings).values(
        roleIds.map((roleId: number) => ({
          templateId: template.id,
          roleId,
          priority: 0,
          isDefault: false,
          isActive: true,
          createdBy: currentUser.userId,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('创建模板失败:', error);
    return NextResponse.json(
      { error: '创建模板失败' },
      { status: 500 }
    );
  }
}

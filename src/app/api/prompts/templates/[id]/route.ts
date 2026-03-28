/**
 * 单个提示词模板API
 * 支持获取、更新、删除模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  promptTemplates, 
  promptParameters, 
  promptVersions,
  promptRoleMappings,
} from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================
// GET: 获取单个模板详情
// ============================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const templateId = parseInt(id);

    // 获取模板基本信息
    const [template] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, templateId));

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 获取模板参数
    const parameters = await db
      .select()
      .from(promptParameters)
      .where(eq(promptParameters.templateId, templateId))
      .orderBy(asc(promptParameters.sortOrder));

    // 获取版本历史
    const versions = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.templateId, templateId))
      .orderBy(asc(promptVersions.version));

    // 获取角色映射
    const roleMappings = await db
      .select({
        id: promptRoleMappings.id,
        roleId: promptRoleMappings.roleId,
        isDefault: promptRoleMappings.isDefault,
        priority: promptRoleMappings.priority,
      })
      .from(promptRoleMappings)
      .where(and(
        eq(promptRoleMappings.templateId, templateId),
        eq(promptRoleMappings.isActive, true)
      ));

    return NextResponse.json({
      template,
      parameters,
      versions,
      roleMappings,
    });
  } catch (error) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json(
      { error: '获取模板详情失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 更新模板
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);
    const body = await request.json();
    const {
      name,
      description,
      categoryId,
      content,
      systemPrompt,
      modelProvider,
      modelName,
      temperature,
      maxTokens,
      outputFormat,
      status,
      parameters,
      roleIds,
      createVersion,
      changeLog,
      // AI角色字段
      isAgent,
      agentRole,
      agentAvatar,
      agentGreeting,
      agentDescription,
      agentSkills,
    } = body;

    // 获取当前模板
    const [currentTemplate] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, templateId));

    if (!currentTemplate) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 检查是否需要创建新版本
    const shouldCreateVersion = createVersion || 
      (content && content !== currentTemplate.content);

    // 更新模板
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (content !== undefined) updateData.content = content;
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (modelProvider !== undefined) updateData.modelProvider = modelProvider;
    if (modelName !== undefined) updateData.modelName = modelName;
    if (temperature !== undefined) updateData.temperature = temperature;
    if (maxTokens !== undefined) updateData.maxTokens = maxTokens;
    if (outputFormat !== undefined) updateData.outputFormat = outputFormat;
    if (status !== undefined) updateData.status = status;
    
    // AI角色字段
    if (isAgent !== undefined) updateData.isAgent = isAgent;
    if (agentRole !== undefined) updateData.agentRole = agentRole;
    if (agentAvatar !== undefined) updateData.agentAvatar = agentAvatar;
    if (agentGreeting !== undefined) updateData.agentGreeting = agentGreeting;
    if (agentDescription !== undefined) updateData.agentDescription = agentDescription;
    if (agentSkills !== undefined) updateData.agentSkills = agentSkills;

    // 如果需要创建新版本
    if (shouldCreateVersion) {
      const newVersion = currentTemplate.currentVersion + 1;
      updateData.currentVersion = newVersion;

      // 创建新版本记录
      await db.insert(promptVersions).values({
        templateId,
        version: newVersion,
        name: name || currentTemplate.name,
        content: content || currentTemplate.content,
        systemPrompt: systemPrompt !== undefined ? systemPrompt : currentTemplate.systemPrompt,
        changeLog: changeLog || `版本 ${newVersion}`,
        modelProvider: modelProvider || currentTemplate.modelProvider,
        modelName: modelName || currentTemplate.modelName,
        temperature: temperature || currentTemplate.temperature,
        maxTokens: maxTokens || currentTemplate.maxTokens,
        outputFormat: outputFormat || currentTemplate.outputFormat,
        authorId: currentUser.userId,
      });
    }

    await db
      .update(promptTemplates)
      .set(updateData)
      .where(eq(promptTemplates.id, templateId));

    // 更新参数（如果有）
    if (parameters !== undefined) {
      // 删除现有参数
      await db
        .delete(promptParameters)
        .where(eq(promptParameters.templateId, templateId));

      // 插入新参数
      if (parameters.length > 0) {
        await db.insert(promptParameters).values(
          parameters.map((p: any, index: number) => ({
            templateId,
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
    }

    // 更新角色映射（如果有）
    if (roleIds !== undefined) {
      // 删除现有映射
      await db
        .delete(promptRoleMappings)
        .where(eq(promptRoleMappings.templateId, templateId));

      // 插入新映射
      if (roleIds.length > 0) {
        await db.insert(promptRoleMappings).values(
          roleIds.map((roleId: number) => ({
            templateId,
            roleId,
            priority: 0,
            isDefault: false,
            isActive: true,
            createdBy: currentUser.userId,
          }))
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新模板失败:', error);
    return NextResponse.json(
      { error: '更新模板失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE: 删除模板
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);

    // 检查模板是否存在
    const [template] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, templateId));

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    // 不允许删除系统模板
    if (template.isSystem) {
      return NextResponse.json(
        { error: '系统内置模板不能删除' },
        { status: 400 }
      );
    }

    // 删除模板（级联删除参数、版本、角色映射）
    await db
      .delete(promptTemplates)
      .where(eq(promptTemplates.id, templateId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json(
      { error: '删除模板失败' },
      { status: 500 }
    );
  }
}

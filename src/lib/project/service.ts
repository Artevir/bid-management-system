/**
 * 项目服务
 * 提供项目的CRUD操作
 */

import { db } from '@/db';
import {
  projects,
  projectMembers,
  projectPhases,
  projectMilestones,
  departments,
  users,
  projectTags,
  projectTagRelations,
  bidArchives,
  bidArchiveDocuments,
  bidDocuments,
  bidDocumentInterpretations,
  bidTechnicalSpecs,
  bidScoringItems,
  bidRequirementChecklist,
  bidDocumentFramework,
} from '@/db/schema';
import {
  eq,
  and,
  or,
  like,
  desc,
  asc,
  inArray,
  sql,
  count,
} from 'drizzle-orm';
import { AppError } from '@/lib/api/error-handler';
import { ProjectStatus } from '@/types/project';

// ============================================
// 项目查询参数类型
// ============================================

export interface ProjectQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: ProjectStatus[];
  industry?: string[];
  region?: string[];
  departmentId?: number;
  ownerId?: number;
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// 项目创建/更新参数类型
// ============================================

export interface CreateProjectData {
  name: string;
  code: string;
  tenderCode?: string;
  type?: string;
  industry?: string;
  region?: string;
  tenderOrganization?: string;
  tenderAgent?: string;
  tenderMethod?: string;
  budget?: string;
  publishDate?: Date;
  registerDeadline?: Date;
  questionDeadline?: Date;
  submissionDeadline?: Date;
  openBidDate?: Date;
  ownerId: number;
  departmentId: number;
  description?: string;
  tags?: string[];
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  status?: ProjectStatus;
  progress?: number;
  currentPhaseId?: number;
}

// ============================================
// 项目列表项类型
// ============================================

export interface ProjectListItem {
  id: number;
  name: string;
  code: string;
  tenderCode: string | null;
  type: string | null;
  industry: string | null;
  region: string | null;
  status: ProjectStatus;
  progress: number;
  ownerId: number;
  ownerName: string;
  departmentId: number;
  departmentName: string;
  submissionDeadline: Date | null;
  openBidDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: ProjectTagItem[];
}

export interface ProjectTagItem {
  id: number;
  name: string;
  color: string;
}

// ============================================
// N+1查询优化：批量加载关联数据
// ============================================

/**
 * 批量加载项目标签（解决N+1问题）
 */
async function batchLoadProjectTags(projectIds: number[]): Promise<Map<number, ProjectTagItem[]>> {
  if (projectIds.length === 0) return new Map();

  // 查询项目-标签关联
  const tagRelations = await db
    .select({
      projectId: projectTagRelations.projectId,
      tagId: projectTagRelations.tagId,
      tagName: projectTags.name,
      tagColor: projectTags.color,
    })
    .from(projectTagRelations)
    .innerJoin(projectTags, eq(projectTagRelations.tagId, projectTags.id))
    .where(inArray(projectTagRelations.projectId, projectIds));

  // 按项目ID分组
  const tagMap = new Map<number, ProjectTagItem[]>();
  for (const rel of tagRelations) {
    if (!tagMap.has(rel.projectId)) {
      tagMap.set(rel.projectId, []);
    }
    tagMap.get(rel.projectId)!.push({
      id: rel.tagId,
      name: rel.tagName,
      color: rel.tagColor,
    });
  }

  return tagMap;
}

// ============================================
// 项目详情类型
// ============================================

export interface ProjectDetail extends ProjectListItem {
  tenderOrganization: string | null;
  tenderAgent: string | null;
  tenderMethod: string | null;
  budget: string | null;
  publishDate: Date | null;
  registerDeadline: Date | null;
  questionDeadline: Date | null;
  description: string | null;
  currentPhaseId: number | null;
  totalScore: number | null;
  completedScore: number | null;
  phases: ProjectPhaseItem[];
  milestones: ProjectMilestoneItem[];
  // 文件解读信息
  interpretationId: number | null;
  interpretation?: {
    id: number;
    documentName: string;
    status: string;
    basicInfo: any;
    technicalSpecs: any[];
    scoringItems: any[];
    checklist: any[];
    documentFramework: any[];
  } | null;
}

export interface ProjectPhaseItem {
  id: number;
  type: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
}

export interface ProjectMilestoneItem {
  id: number;
  phaseId: number | null;
  name: string;
  description: string | null;
  dueDate: Date;
  completedAt: Date | null;
  status: string;
  reminderSent: boolean;
  reminderDays: number;
}

// ============================================
// 项目服务函数
// ============================================

/**
 * 获取项目列表
 */
export async function getProjectList(
  params: ProjectQueryParams,
  userId: number
): Promise<{ items: ProjectListItem[]; total: number }> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    status,
    industry,
    region,
    departmentId,
    ownerId,
    startDateFrom,
    startDateTo,
    endDateFrom,
    endDateTo,
    tags,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  // 构建查询条件
  const conditions = [eq(projects.isDeleted, false)]; // 默认过滤已删除项目

  // 用户只能看到自己是成员的项目（或者自己部门的项目）
  // 这里简化为用户可以看到所有项目，实际应该加上权限过滤
  // conditions.push(eq(projects.id, sql`ANY(SELECT project_id FROM ${projectMembers} WHERE user_id = ${userId})`));

  if (keyword) {
    const keywordCondition = or(
      like(projects.name, `%${keyword}%`),
      like(projects.code, `%${keyword}%`),
      like(projects.tenderCode, `%${keyword}%`)
    );
    if (keywordCondition) {
      conditions.push(keywordCondition);
    }
  }

  if (status && status.length > 0) {
    conditions.push(inArray(projects.status, status));
  }

  if (industry && industry.length > 0) {
    conditions.push(inArray(projects.industry, industry));
  }

  if (region && region.length > 0) {
    conditions.push(inArray(projects.region, region));
  }

  if (departmentId) {
    conditions.push(eq(projects.departmentId, departmentId));
  }

  if (ownerId) {
    conditions.push(eq(projects.ownerId, ownerId));
  }

  // 标签筛选：通过子查询获取包含指定标签的项目
  if (tags && tags.length > 0) {
    // 获取包含任一指定标签的项目ID
    const tagIds = tags.map(t => parseInt(t, 10)).filter(id => !isNaN(id));
    if (tagIds.length > 0) {
      const projectIdsWithTag = await db
        .selectDistinct({ projectId: projectTagRelations.projectId })
        .from(projectTagRelations)
        .where(inArray(projectTagRelations.tagId, tagIds));
      
      const projectIds = projectIdsWithTag.map(p => p.projectId);
      if (projectIds.length > 0) {
        conditions.push(inArray(projects.id, projectIds));
      } else {
        // 没有匹配的项目，返回空结果
        return { items: [], total: 0 };
      }
    }
  }

  // 排序
  const orderDirection = sortOrder === 'asc' ? asc : desc;
  let orderBy;
  switch (sortBy) {
    case 'name':
      orderBy = orderDirection(projects.name);
      break;
    case 'status':
      orderBy = orderDirection(projects.status);
      break;
    case 'submissionDeadline':
      orderBy = orderDirection(projects.submissionDeadline);
      break;
    case 'progress':
      orderBy = orderDirection(projects.progress);
      break;
    default:
      orderBy = orderDirection(projects.createdAt);
  }

  // 查询总数
  const countResult = await db
    .select({ count: count() })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = countResult[0]?.count || 0;

  // 查询列表
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      code: projects.code,
      tenderCode: projects.tenderCode,
      type: projects.type,
      industry: projects.industry,
      region: projects.region,
      status: projects.status,
      progress: projects.progress,
      ownerId: projects.ownerId,
      ownerName: users.realName,
      departmentId: projects.departmentId,
      departmentName: departments.name,
      submissionDeadline: projects.submissionDeadline,
      openBidDate: projects.openBidDate,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(users, eq(projects.ownerId, users.id))
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // N+1优化：批量加载标签
  const projectIds = result.map(p => p.id);
  const tagMap = await batchLoadProjectTags(projectIds);

  // 组装最终结果
  const items: ProjectListItem[] = result.map(item => ({
    ...item,
    ownerName: item.ownerName || '',
    departmentName: item.departmentName || '',
    tags: tagMap.get(item.id) || [],
  }));

  return {
    items,
    total,
  };
}

/**
 * 获取项目详情
 */
export async function getProjectById(
  projectId: number,
  userId: number
): Promise<ProjectDetail | null> {
  // 查询项目基本信息
  const projectResult = await db
    .select({
      id: projects.id,
      name: projects.name,
      code: projects.code,
      tenderCode: projects.tenderCode,
      type: projects.type,
      industry: projects.industry,
      region: projects.region,
      status: projects.status,
      progress: projects.progress,
      currentPhaseId: projects.currentPhaseId,
      totalScore: projects.totalScore,
      completedScore: projects.completedScore,
      tenderOrganization: projects.tenderOrganization,
      tenderAgent: projects.tenderAgent,
      tenderMethod: projects.tenderMethod,
      budget: projects.budget,
      publishDate: projects.publishDate,
      registerDeadline: projects.registerDeadline,
      questionDeadline: projects.questionDeadline,
      submissionDeadline: projects.submissionDeadline,
      openBidDate: projects.openBidDate,
      description: projects.description,
      tags: projects.tags,
      ownerId: projects.ownerId,
      ownerName: users.realName,
      departmentId: projects.departmentId,
      departmentName: departments.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(users, eq(projects.ownerId, users.id))
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(and(eq(projects.id, projectId), eq(projects.isDeleted, false)))
    .limit(1);

  if (projectResult.length === 0) {
    return null;
  }

  const project = projectResult[0];

  // 查询项目阶段
  const phases = await db
    .select({
      id: projectPhases.id,
      type: projectPhases.type,
      name: projectPhases.name,
      description: projectPhases.description,
      sortOrder: projectPhases.sortOrder,
      status: projectPhases.status,
      startDate: projectPhases.startDate,
      endDate: projectPhases.endDate,
      completedAt: projectPhases.completedAt,
    })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))
    .orderBy(asc(projectPhases.sortOrder));

  // 查询项目节点
  const milestones = await db
    .select({
      id: projectMilestones.id,
      phaseId: projectMilestones.phaseId,
      name: projectMilestones.name,
      description: projectMilestones.description,
      dueDate: projectMilestones.dueDate,
      completedAt: projectMilestones.completedAt,
      status: projectMilestones.status,
      reminderSent: projectMilestones.reminderSent,
      reminderDays: projectMilestones.reminderDays,
    })
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, projectId))
    .orderBy(asc(projectMilestones.dueDate));

  // 查询关联的文件解读信息
  let interpretationData = null;
  const interpretationResult = await db
    .select({
      id: bidDocumentInterpretations.id,
      documentName: bidDocumentInterpretations.documentName,
      status: bidDocumentInterpretations.status,
      basicInfo: bidDocumentInterpretations.basicInfo,
    })
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.projectId, projectId))
    .limit(1);

  if (interpretationResult.length > 0) {
    const interp = interpretationResult[0];
    
    // 查询技术规格
    const technicalSpecs = await db
      .select()
      .from(bidTechnicalSpecs)
      .where(eq(bidTechnicalSpecs.interpretationId, interp.id));

    // 查询评分细则
    const scoringItems = await db
      .select()
      .from(bidScoringItems)
      .where(eq(bidScoringItems.interpretationId, interp.id));

    // 查询核对清单
    const checklist = await db
      .select()
      .from(bidRequirementChecklist)
      .where(eq(bidRequirementChecklist.interpretationId, interp.id));

    // 查询文档框架
    const documentFramework = await db
      .select()
      .from(bidDocumentFramework)
      .where(eq(bidDocumentFramework.interpretationId, interp.id));

    interpretationData = {
      id: interp.id,
      documentName: interp.documentName,
      status: interp.status,
      basicInfo: interp.basicInfo,
      technicalSpecs: technicalSpecs || [],
      scoringItems: scoringItems || [],
      checklist: checklist || [],
      documentFramework: documentFramework || [],
    };
  }

  return {
    ...project,
    tags: project.tags ? JSON.parse(project.tags) : [],
    phases: phases as ProjectPhaseItem[],
    milestones: milestones as ProjectMilestoneItem[],
    interpretationId: interpretationData?.id || null,
    interpretation: interpretationData,
  } as ProjectDetail;
}

/**
 * 创建项目
 */
export async function createProject(
  data: CreateProjectData,
  userId: number
): Promise<number> {
  // 检查项目编码是否已存在（包括已删除的）
  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.code, data.code))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].isDeleted) {
      throw AppError.conflict('该项目编码属于已删除的项目，请使用新的项目编码或恢复原项目');
    }
    throw AppError.conflict('项目编码已存在');
  }

  // 使用事务确保数据一致性
  const projectId = await db.transaction(async (tx) => {
    // 创建项目
    const result = await tx
      .insert(projects)
      .values({
        name: data.name,
        code: data.code,
        tenderCode: data.tenderCode,
        type: data.type,
        industry: data.industry,
        region: data.region,
        tenderOrganization: data.tenderOrganization,
        tenderAgent: data.tenderAgent,
        tenderMethod: data.tenderMethod,
        budget: data.budget,
        publishDate: data.publishDate,
        registerDeadline: data.registerDeadline,
        questionDeadline: data.questionDeadline,
        submissionDeadline: data.submissionDeadline,
        openBidDate: data.openBidDate,
        ownerId: data.ownerId,
        departmentId: data.departmentId,
        description: data.description,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        status: 'draft',
        progress: 0,
      })
      .returning({ id: projects.id });

    const newProjectId = result[0].id;

    // 将项目负责人添加为项目成员
    await tx.insert(projectMembers).values({
      projectId: newProjectId,
      userId: data.ownerId,
      role: 'owner',
      canView: true,
      canEdit: true,
      canAudit: true,
      canExport: true,
      maxSecurityLevel: 'secret',
      invitedBy: userId,
    });

    // 创建默认阶段
    const defaultPhases: Array<{ type: 'preparation' | 'analysis' | 'drafting' | 'review' | 'submission'; name: string; sortOrder: number }> = [
      { type: 'preparation', name: '准备阶段', sortOrder: 1 },
      { type: 'analysis', name: '分析阶段', sortOrder: 2 },
      { type: 'drafting', name: '编制阶段', sortOrder: 3 },
      { type: 'review', name: '审核阶段', sortOrder: 4 },
      { type: 'submission', name: '投标阶段', sortOrder: 5 },
    ];

    await tx.insert(projectPhases).values(
      defaultPhases.map(phase => ({
        projectId: newProjectId,
        type: phase.type,
        name: phase.name,
        sortOrder: phase.sortOrder,
        status: phase.sortOrder === 1 ? 'in_progress' : 'pending',
      }))
    );

    // 创建关键里程碑节点
    const milestones = [];
    if (data.submissionDeadline) {
      milestones.push({
        projectId: newProjectId,
        name: '投标截止',
        description: '投标文件提交截止时间',
        dueDate: data.submissionDeadline,
        status: 'pending',
        reminderDays: 3,
        sortOrder: 1,
      });
    }

    if (data.openBidDate) {
      milestones.push({
        projectId: newProjectId,
        name: '开标日期',
        description: '开标时间',
        dueDate: data.openBidDate,
        status: 'pending',
        reminderDays: 1,
        sortOrder: 2,
      });
    }

    if (data.registerDeadline) {
      milestones.push({
        projectId: newProjectId,
        name: '报名截止',
        description: '投标报名截止时间',
        dueDate: data.registerDeadline,
        status: 'pending',
        reminderDays: 2,
        sortOrder: 0,
      });
    }

    if (milestones.length > 0) {
      await tx.insert(projectMilestones).values(milestones);
    }

    return newProjectId;
  });

  return projectId;
}

/**
 * 更新项目
 */
export async function updateProject(
  projectId: number,
  data: UpdateProjectData,
  userId: number
): Promise<boolean> {
  // 检查项目是否存在且未被删除
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.isDeleted, false)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('项目不存在');
  }

  const oldStatus = existing[0].status;
  const project = existing[0];

  // 如果更新编码，检查是否与其他项目冲突
  if (data.code && data.code !== existing[0].code) {
    const duplicate = await db
      .select()
      .from(projects)
      .where(and(eq(projects.code, data.code), sql`${projects.id} != ${projectId}`))
      .limit(1);

    if (duplicate.length > 0) {
      throw new Error('项目编码已被其他项目使用');
    }
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  // 只包含有效的更新字段
  const allowedFields: (keyof typeof projects.$inferInsert)[] = [
    'name', 'code', 'tenderCode', 'type', 'industry', 'region',
    'status', 'progress', 'currentPhaseId', 'tenderOrganization',
    'tenderAgent', 'tenderMethod', 'budget', 'publishDate',
    'registerDeadline', 'questionDeadline', 'submissionDeadline',
    'openBidDate', 'description', 'totalScore', 'completedScore',
  ];

  for (const field of allowedFields) {
    if (field in data && data[field as keyof UpdateProjectData] !== undefined) {
      updateData[field] = data[field as keyof UpdateProjectData];
    }
  }

  // 特殊处理tags字段
  if (data.tags) {
    updateData.tags = JSON.stringify(data.tags);
  }

  await db.update(projects).set(updateData as typeof projects.$inferInsert).where(eq(projects.id, projectId));

  // 如果项目状态变为中标或未中标，触发自动归档
  if (data.status && ['awarded', 'lost'].includes(data.status) && oldStatus !== data.status) {
    try {
      await autoArchiveProject(projectId, data.status === 'awarded' ? 'awarded' : 'lost', userId);
    } catch (error) {
      console.error('自动归档失败:', error);
      // 不抛出错误，允许项目状态更新成功
    }
  }

  return true;
}

/**
 * 自动归档项目
 */
async function autoArchiveProject(
  projectId: number,
  bidResult: 'awarded' | 'lost',
  userId: number
): Promise<void> {
  // 检查是否已归档
  const [existingArchive] = await db
    .select()
    .from(bidArchives)
    .where(eq(bidArchives.projectId, projectId));

  if (existingArchive) {
    return; // 已归档，跳过
  }

  // 获取项目信息
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    return;
  }

  // 创建归档记录
  const [archive] = await db
    .insert(bidArchives)
    .values({
      projectId,
      projectName: project.name,
      projectCode: project.code,
      tenderCode: project.tenderCode,
      tenderOrganization: project.tenderOrganization,
      tenderAgent: project.tenderAgent,
      budget: project.budget,
      archiveType: 'auto',
      bidResult,
      archivedBy: userId,
    })
    .returning();

  // 归档项目下所有文档
  const docs = await db
    .select()
    .from(bidDocuments)
    .where(eq(bidDocuments.projectId, projectId));

  for (const doc of docs) {
    await db.insert(bidArchiveDocuments).values({
      archiveId: archive.id,
      documentId: doc.id,
      documentName: doc.name,
      documentVersion: doc.version,
      documentStatus: doc.status,
      chapterCount: doc.totalChapters,
      wordCount: doc.wordCount,
    });
  }

  // 更新归档文档数量
  await db
    .update(bidArchives)
    .set({ documentCount: docs.length })
    .where(eq(bidArchives.id, archive.id));

  // 更新项目状态为已归档
  await db
    .update(projects)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

/**
 * 删除项目（软删除）
 */
export async function deleteProject(
  projectId: number,
  userId: number
): Promise<boolean> {
  // 检查项目是否存在
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.isDeleted, false)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('项目不存在');
  }

  // 软删除：标记为已删除
  await db
    .update(projects)
    .set({ 
      isDeleted: true, 
      deletedAt: new Date(), 
      deletedBy: userId,
      updatedAt: new Date() 
    })
    .where(eq(projects.id, projectId));

  return true;
}

/**
 * 获取项目统计数据
 */
export async function getProjectStats(userId: number): Promise<{
  total: number;
  byStatus: Record<ProjectStatus, number>;
  byIndustry: { industry: string; count: number }[];
  byRegion: { region: string; count: number }[];
}> {
  // 总数（过滤已删除的项目）
  const totalResult = await db.select({ count: count() }).from(projects).where(eq(projects.isDeleted, false));
  const total = totalResult[0]?.count || 0;

  // 按状态统计（过滤已删除的项目）
  const statusResult = await db
    .select({
      status: projects.status,
      count: count(),
    })
    .from(projects)
    .where(eq(projects.isDeleted, false))
    .groupBy(projects.status);

  const byStatus: Record<ProjectStatus, number> = {
    draft: 0,
    parsing: 0,
    preparing: 0,
    reviewing: 0,
    approved: 0,
    submitted: 0,
    awarded: 0,
    lost: 0,
    completed: 0,
    archived: 0,
  };

  statusResult.forEach((item) => {
    byStatus[item.status as ProjectStatus] = item.count;
  });

  // 按行业统计（过滤已删除的项目）
  const industryResult = await db
    .select({
      industry: projects.industry,
      count: count(),
    })
    .from(projects)
    .where(and(sql`${projects.industry} IS NOT NULL`, eq(projects.isDeleted, false)))
    .groupBy(projects.industry);

  const byIndustry = industryResult.map((item) => ({
    industry: item.industry || '未知',
    count: item.count,
  }));

  // 按区域统计（过滤已删除的项目）
  const regionResult = await db
    .select({
      region: projects.region,
      count: count(),
    })
    .from(projects)
    .where(and(sql`${projects.region} IS NOT NULL`, eq(projects.isDeleted, false)))
    .groupBy(projects.region);

  const byRegion = regionResult.map((item) => ({
    region: item.region || '未知',
    count: item.count,
  }));

  return {
    total,
    byStatus,
    byIndustry,
    byRegion,
  };
}

/**
 * 获取我的项目列表（用户作为成员或负责人）
 */
export async function getMyProjects(
  userId: number,
  params: ProjectQueryParams
): Promise<{ items: ProjectListItem[]; total: number }> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  // 构建查询条件 - 过滤已删除的项目
  const conditions = [
    eq(projects.isDeleted, false),
    or(
      eq(projects.ownerId, userId),
      sql`${projects.id} IN (SELECT project_id FROM ${projectMembers} WHERE user_id = ${userId})`
    ),
  ];

  if (keyword) {
    conditions.push(
      or(
        like(projects.name, `%${keyword}%`),
        like(projects.code, `%${keyword}%`)
      )
    );
  }

  if (status && status.length > 0) {
    conditions.push(inArray(projects.status, status));
  }

  // 排序
  const orderDirection = sortOrder === 'asc' ? asc : desc;
  let orderBy;
  switch (sortBy) {
    case 'name':
      orderBy = orderDirection(projects.name);
      break;
    case 'submissionDeadline':
      orderBy = orderDirection(projects.submissionDeadline);
      break;
    default:
      orderBy = orderDirection(projects.createdAt);
  }

  // 查询总数
  const countResult = await db
    .select({ count: count() })
    .from(projects)
    .where(and(...conditions));

  const total = countResult[0]?.count || 0;

  // 查询列表
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      code: projects.code,
      tenderCode: projects.tenderCode,
      type: projects.type,
      industry: projects.industry,
      region: projects.region,
      status: projects.status,
      progress: projects.progress,
      ownerId: projects.ownerId,
      ownerName: users.realName,
      departmentId: projects.departmentId,
      departmentName: departments.name,
      submissionDeadline: projects.submissionDeadline,
      openBidDate: projects.openBidDate,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(users, eq(projects.ownerId, users.id))
    .leftJoin(departments, eq(projects.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: result as ProjectListItem[],
    total,
  };
}

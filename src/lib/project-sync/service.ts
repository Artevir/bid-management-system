/**
 * 项目信息联动服务
 * 实现文件解读信息与项目的全周期联动
 *
 * 核心功能：
 * 1. 同步解读信息到项目（syncProjectFromInterpretation）
 * 2. 获取项目完整信息（包含解读详情）
 * 3. 为各模块提供统一的项目信息访问接口
 */

import { db } from '@/db';
import {
  projects,
  bidDocumentInterpretations,
  bidTechnicalSpecs,
  bidScoringItems,
  bidRequirementChecklist,
  bidDocumentFramework,
  bidTimeReminders,
  type Project,
  type BidDocumentInterpretation,
} from '@/db/schema';
import { eq, and, desc, isNotNull, inArray, sql } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface ProjectFullInfo {
  project: Project;
  interpretation: BidDocumentInterpretation | null;
  technicalSpecs: any[];
  scoringItems: any[];
  checklist: any[];
  documentFramework: any[];
  timeReminders: any[];
  qualificationRequirements: any;
  personnelRequirements: any;
  docRequirements: any;
}

export interface SyncResult {
  success: boolean;
  message: string;
  updatedFields: string[];
}

// ============================================
// 同步解读信息到项目
// ============================================

export async function syncProjectFromInterpretation(
  projectId: number,
  interpretationId: number,
  _operatorId: number
): Promise<SyncResult> {
  // 获取解读信息
  const [interpretation] = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.id, interpretationId))
    .limit(1);

  if (!interpretation) {
    return { success: false, message: '解读记录不存在', updatedFields: [] };
  }

  // 获取项目信息
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) {
    return { success: false, message: '项目不存在', updatedFields: [] };
  }

  const updatedFields: string[] = [];
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  };

  // 同步项目名称（如果解读出来的名称更完整）
  if (interpretation.projectName && interpretation.projectName !== project.name) {
    updates.name = interpretation.projectName;
    updatedFields.push('项目名称');
  }

  // 同步项目编号/招标编号
  if (interpretation.projectCode && interpretation.projectCode !== project.tenderCode) {
    updates.tenderCode = interpretation.projectCode;
    updatedFields.push('招标编号');
  }

  // 同步招标单位
  if (
    interpretation.tenderOrganization &&
    interpretation.tenderOrganization !== project.tenderOrganization
  ) {
    updates.tenderOrganization = interpretation.tenderOrganization;
    updatedFields.push('招标单位');
  }

  // 同步招标代理
  if (interpretation.tenderAgent && interpretation.tenderAgent !== project.tenderAgent) {
    updates.tenderAgent = interpretation.tenderAgent;
    updatedFields.push('招标代理');
  }

  // 同步项目预算
  if (interpretation.projectBudget && interpretation.projectBudget !== project.budget) {
    updates.budget = interpretation.projectBudget;
    updatedFields.push('项目预算');
  }

  // 同步投标截止时间
  if (
    interpretation.submissionDeadline &&
    (!project.submissionDeadline ||
      new Date(interpretation.submissionDeadline).getTime() !==
        new Date(project.submissionDeadline).getTime())
  ) {
    updates.submissionDeadline = interpretation.submissionDeadline;
    updatedFields.push('投标截止时间');
  }

  // 同步开标时间
  if (
    interpretation.openBidTime &&
    (!project.openBidDate ||
      new Date(interpretation.openBidTime).getTime() !== new Date(project.openBidDate).getTime())
  ) {
    updates.openBidDate = interpretation.openBidTime;
    updatedFields.push('开标时间');
  }

  // 同步答疑截止时间
  if (
    interpretation.questionDeadline &&
    (!project.questionDeadline ||
      new Date(interpretation.questionDeadline).getTime() !==
        new Date(project.questionDeadline).getTime())
  ) {
    updates.questionDeadline = interpretation.questionDeadline;
    updatedFields.push('答疑截止时间');
  }

  // 更新项目
  if (updatedFields.length > 0) {
    await db.update(projects).set(updates).where(eq(projects.id, projectId));

    // 更新解读记录的关联
    await db
      .update(bidDocumentInterpretations)
      .set({ projectId })
      .where(eq(bidDocumentInterpretations.id, interpretationId));
  }

  return {
    success: true,
    message:
      updatedFields.length > 0
        ? `成功同步 ${updatedFields.length} 个字段：${updatedFields.join('、')}`
        : '项目信息已是最新，无需同步',
    updatedFields,
  };
}

// ============================================
// 自动同步：解读完成后自动更新关联项目
// ============================================

export async function autoSyncToProject(interpretationId: number): Promise<SyncResult | null> {
  const [interpretation] = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.id, interpretationId))
    .limit(1);

  if (!interpretation || !interpretation.projectId) {
    return null;
  }

  return syncProjectFromInterpretation(
    interpretation.projectId,
    interpretationId,
    interpretation.uploaderId
  );
}

// ============================================
// 获取项目完整信息（包含解读详情）
// ============================================

export async function getProjectFullInfo(projectId: number): Promise<ProjectFullInfo | null> {
  // 获取项目基本信息
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) {
    return null;
  }

  // 获取关联的最新解读记录
  const [interpretation] = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.projectId, projectId))
    .orderBy(desc(bidDocumentInterpretations.createdAt))
    .limit(1);

  // 如果没有解读记录，返回基本信息
  if (!interpretation) {
    return {
      project,
      interpretation: null,
      technicalSpecs: [],
      scoringItems: [],
      checklist: [],
      documentFramework: [],
      timeReminders: [],
      qualificationRequirements: null,
      personnelRequirements: null,
      docRequirements: null,
    };
  }

  // 获取技术规格
  const technicalSpecs = await db
    .select()
    .from(bidTechnicalSpecs)
    .where(eq(bidTechnicalSpecs.interpretationId, interpretation.id));

  // 获取评分细则
  const scoringItems = await db
    .select()
    .from(bidScoringItems)
    .where(eq(bidScoringItems.interpretationId, interpretation.id));

  // 获取核对清单
  const checklist = await db
    .select()
    .from(bidRequirementChecklist)
    .where(eq(bidRequirementChecklist.interpretationId, interpretation.id));

  // 获取文档框架
  const documentFramework = await db
    .select()
    .from(bidDocumentFramework)
    .where(eq(bidDocumentFramework.interpretationId, interpretation.id));

  // 获取时间提醒
  const timeReminders = await db
    .select()
    .from(bidTimeReminders)
    .where(eq(bidTimeReminders.interpretationId, interpretation.id));

  // 解析JSON字段
  let qualificationRequirements = null;
  let personnelRequirements = null;
  let docRequirements = null;

  try {
    if (interpretation.qualificationRequirements) {
      qualificationRequirements = JSON.parse(interpretation.qualificationRequirements);
    }
  } catch (_e) {
    qualificationRequirements = interpretation.qualificationRequirements;
  }

  try {
    if (interpretation.personnelRequirements) {
      personnelRequirements = JSON.parse(interpretation.personnelRequirements);
    }
  } catch (_e) {
    personnelRequirements = interpretation.personnelRequirements;
  }

  try {
    if (interpretation.docRequirements) {
      docRequirements = JSON.parse(interpretation.docRequirements);
    }
  } catch (_e) {
    docRequirements = interpretation.docRequirements;
  }

  return {
    project,
    interpretation,
    technicalSpecs,
    scoringItems,
    checklist,
    documentFramework,
    timeReminders,
    qualificationRequirements,
    personnelRequirements,
    docRequirements,
  };
}

// ============================================
// 获取项目关键信息（简化版，供其他模块快速调用）
// ============================================

export async function getProjectKeyInfo(projectId: number) {
  const fullInfo = await getProjectFullInfo(projectId);

  if (!fullInfo) {
    return null;
  }

  const { project, interpretation } = fullInfo;

  return {
    id: project.id,
    name: project.name,
    code: project.code,
    tenderCode: project.tenderCode || interpretation?.projectCode,
    status: project.status,

    // 招标信息
    tenderOrganization: project.tenderOrganization || interpretation?.tenderOrganization,
    tenderAgent: project.tenderAgent || interpretation?.tenderAgent,
    budget: project.budget || interpretation?.projectBudget,

    // 关键时间节点
    submissionDeadline: project.submissionDeadline || interpretation?.submissionDeadline,
    openBidDate: project.openBidDate || interpretation?.openBidTime,
    questionDeadline: project.questionDeadline || interpretation?.questionDeadline,
    openBidLocation: interpretation?.openBidLocation,

    // 解读信息ID
    interpretationId: interpretation?.id,

    // 资质要求
    qualificationRequirements: fullInfo.qualificationRequirements,
    personnelRequirements: fullInfo.personnelRequirements,
    docRequirements: fullInfo.docRequirements,

    // 统计信息
    specCount: interpretation?.specCount || 0,
    scoringCount: interpretation?.scoringCount || 0,
    checklistCount: interpretation?.checklistCount || 0,

    // 项目负责人
    ownerId: project.ownerId,
  };
}

// ============================================
// 获取项目的时间提醒列表
// ============================================

export async function getProjectTimeReminders(projectId: number) {
  const fullInfo = await getProjectFullInfo(projectId);

  if (!fullInfo || !fullInfo.interpretation) {
    return [];
  }

  return fullInfo.timeReminders;
}

// ============================================
// 获取项目的资质要求列表
// ============================================

export async function getProjectQualificationRequirements(projectId: number) {
  const fullInfo = await getProjectFullInfo(projectId);

  if (!fullInfo || !fullInfo.interpretation) {
    return null;
  }

  return {
    qualification: fullInfo.qualificationRequirements,
    personnel: fullInfo.personnelRequirements,
    doc: fullInfo.docRequirements,
  };
}

// ============================================
// 获取项目的技术规格列表
// ============================================

export async function getProjectTechnicalSpecs(projectId: number, category?: string) {
  const fullInfo = await getProjectFullInfo(projectId);

  if (!fullInfo || !fullInfo.interpretation) {
    return [];
  }

  if (category) {
    return fullInfo.technicalSpecs.filter((spec) => spec.specCategory === category);
  }

  return fullInfo.technicalSpecs;
}

// ============================================
// 获取项目的评分细则
// ============================================

export async function getProjectScoringItems(projectId: number, category?: string) {
  const fullInfo = await getProjectFullInfo(projectId);

  if (!fullInfo || !fullInfo.interpretation) {
    return [];
  }

  if (category) {
    return fullInfo.scoringItems.filter((item) => item.scoringCategory === category);
  }

  return fullInfo.scoringItems;
}

// ============================================
// 获取项目的文档框架
// ============================================

export async function getProjectDocumentFramework(projectId: number) {
  const fullInfo = await getProjectFullInfo(projectId);

  if (!fullInfo || !fullInfo.interpretation) {
    return [];
  }

  return fullInfo.documentFramework;
}

// ============================================
// 批量获取项目信息（供列表使用）
// ============================================

export async function getProjectsWithInterpretation(filters?: {
  status?: string;
  keyword?: string;
  ownerId?: number;
}) {
  const conditions = [eq(projects.isDeleted, false)];

  if (filters?.status) {
    conditions.push(eq(projects.status, filters.status as any));
  }

  if (filters?.ownerId) {
    conditions.push(eq(projects.ownerId, filters.ownerId));
  }

  // 获取项目列表
  const projectList = await db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.createdAt))
    .limit(100);

  // 批量获取关联的解读信息
  const projectIds = projectList.map((p) => p.id);

  const interpretations =
    projectIds.length > 0
      ? await db
          .select()
          .from(bidDocumentInterpretations)
          .where(
            and(
              isNotNull(bidDocumentInterpretations.projectId),
              inArray(bidDocumentInterpretations.projectId, projectIds)
            )
          )
          .orderBy(desc(bidDocumentInterpretations.createdAt))
      : [];

  // 关联项目和解读信息
  const interpretationMap = new Map();
  interpretations.forEach((interp) => {
    if (interp.projectId && !interpretationMap.has(interp.projectId)) {
      interpretationMap.set(interp.projectId, interp);
    }
  });

  return projectList.map((project) => ({
    project,
    interpretation: interpretationMap.get(project.id) || null,
    hasInterpretation: interpretationMap.has(project.id),
  }));
}

// ============================================
// 检查项目是否有解读信息
// ============================================

export async function checkProjectHasInterpretation(projectId: number): Promise<boolean> {
  const [result] = await db
    .select({ id: bidDocumentInterpretations.id })
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.projectId, projectId))
    .limit(1);

  return !!result;
}

// ============================================
// 获取可同步的解读列表（未关联项目的）
// ============================================

export async function getUnlinkedInterpretations(uploaderId?: number) {
  const conditions = [sql`${bidDocumentInterpretations.projectId} IS NULL`];

  if (uploaderId) {
    conditions.push(eq(bidDocumentInterpretations.uploaderId, uploaderId));
  }

  return db
    .select()
    .from(bidDocumentInterpretations)
    .where(and(...conditions))
    .orderBy(desc(bidDocumentInterpretations.createdAt))
    .limit(50);
}

// ============================================
// 将解读关联到项目（创建新项目或关联已有项目）
// ============================================

export async function linkInterpretationToProject(
  interpretationId: number,
  projectId: number | null,
  operatorId: number
): Promise<{ success: boolean; message: string; projectId?: number }> {
  const [interpretation] = await db
    .select()
    .from(bidDocumentInterpretations)
    .where(eq(bidDocumentInterpretations.id, interpretationId))
    .limit(1);

  if (!interpretation) {
    return { success: false, message: '解读记录不存在' };
  }

  if (projectId) {
    // 关联到已有项目
    await db
      .update(bidDocumentInterpretations)
      .set({ projectId })
      .where(eq(bidDocumentInterpretations.id, interpretationId));

    // 同步信息
    await syncProjectFromInterpretation(projectId, interpretationId, operatorId);

    return { success: true, message: '已关联到项目并同步信息', projectId };
  } else {
    // 创建新项目
    const [newProject] = await db
      .insert(projects)
      .values({
        name: interpretation.projectName || interpretation.documentName.replace(/\.[^/.]+$/, ''),
        code: `PRJ-${Date.now()}`,
        tenderCode: interpretation.projectCode,
        tenderOrganization: interpretation.tenderOrganization,
        tenderAgent: interpretation.tenderAgent,
        budget: interpretation.projectBudget,
        submissionDeadline: interpretation.submissionDeadline,
        openBidDate: interpretation.openBidTime,
        questionDeadline: interpretation.questionDeadline,
        ownerId: operatorId,
        departmentId: 1, // 默认部门，实际应根据用户获取
        status: 'draft',
      })
      .returning({ id: projects.id });

    // 更新解读记录
    await db
      .update(bidDocumentInterpretations)
      .set({ projectId: newProject.id })
      .where(eq(bidDocumentInterpretations.id, interpretationId));

    return {
      success: true,
      message: '已创建新项目并关联解读信息',
      projectId: newProject.id,
    };
  }
}

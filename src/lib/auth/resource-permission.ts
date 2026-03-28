/**
 * 资源权限服务
 * 提供文档、公司资料等资源的细粒度权限控制
 * 
 * 权限类型：
 * - read: 阅读权限
 * - edit: 修改权限
 * - delete: 删除权限
 */

import { db } from '@/db';
import {
  files,
  fileVersions,
  bidDocuments,
  bidChapters,
  companies,
  companyFiles,
  projectMembers,
  projects,
  users,
} from '@/db/schema';
import { eq, and, or, inArray, isNull } from 'drizzle-orm';
import { hasPermission, getUserRoles } from './permission';

// ============================================
// 类型定义
// ============================================

/** 资源类型 */
export type ResourceType = 
  | 'document'      // 标书文档
  | 'chapter'       // 文档章节
  | 'file'          // 文件
  | 'company'       // 公司
  | 'company_file'; // 公司文件

/** 权限操作 */
export type PermissionAction = 'read' | 'edit' | 'delete';

/** 权限检查结果 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermission?: string;
}

/** 资源权限信息 */
export interface ResourcePermission {
  resourceType: ResourceType;
  resourceId: number;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ============================================
// 权限代码常量
// ============================================

export const PERMISSION_CODES = {
  // 文档权限
  DOCUMENT_READ: 'document:read',
  DOCUMENT_EDIT: 'document:edit',
  DOCUMENT_DELETE: 'document:delete',
  DOCUMENT_MANAGE: 'document:manage', // 管理所有文档
  
  // 文件权限
  FILE_READ: 'file:read',
  FILE_EDIT: 'file:edit',
  FILE_DELETE: 'file:delete',
  FILE_MANAGE: 'file:manage',
  
  // 公司权限
  COMPANY_READ: 'company:read',
  COMPANY_EDIT: 'company:edit',
  COMPANY_DELETE: 'company:delete',
  COMPANY_MANAGE: 'company:manage',
  
  // 公司文件权限
  COMPANY_FILE_READ: 'company_file:read',
  COMPANY_FILE_EDIT: 'company_file:edit',
  COMPANY_FILE_DELETE: 'company_file:delete',
  
  // 管理员权限
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

// ============================================
// 文档权限检查
// ============================================

/**
 * 检查用户对文档的权限
 * @param userId 用户ID
 * @param documentId 文档ID
 * @param action 操作类型
 */
export async function checkDocumentPermission(
  userId: number,
  documentId: number,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  // 1. 检查是否有管理所有文档的权限
  const hasManagePermission = await hasPermission(userId, PERMISSION_CODES.DOCUMENT_MANAGE);
  if (hasManagePermission) {
    return { allowed: true };
  }

  // 2. 检查是否有全局权限
  const globalPermissions: Record<PermissionAction, string> = {
    read: PERMISSION_CODES.DOCUMENT_READ,
    edit: PERMISSION_CODES.DOCUMENT_EDIT,
    delete: PERMISSION_CODES.DOCUMENT_DELETE,
  };

  const hasGlobalPermission = await hasPermission(userId, globalPermissions[action]);
  if (hasGlobalPermission) {
    // 有全局权限，但需要检查是否是文档的创建者或项目成员
    const doc = await getDocumentWithProject(documentId);
    if (!doc) {
      return { allowed: false, reason: '文档不存在' };
    }

    // 检查是否是创建者
    if (doc.createdBy === userId) {
      return { allowed: true };
    }

    // 检查是否是项目成员
    if (doc.projectId) {
      const memberPermission = await checkProjectMemberPermission(doc.projectId, userId, action);
      if (memberPermission.allowed) {
        return { allowed: true };
      }
    }

    return { allowed: false, reason: '您不是该文档的创建者或项目成员' };
  }

  // 3. 检查是否是项目成员且有对应权限
  const doc = await getDocumentWithProject(documentId);
  if (!doc) {
    return { allowed: false, reason: '文档不存在' };
  }

  // 创建者拥有所有权限
  if (doc.createdBy === userId) {
    return { allowed: true };
  }

  // 检查项目成员权限
  if (doc.projectId) {
    return checkProjectMemberPermission(doc.projectId, userId, action);
  }

  return { allowed: false, reason: '权限不足' };
}

/**
 * 获取文档及其项目信息
 */
async function getDocumentWithProject(documentId: number) {
  const [doc] = await db
    .select({
      id: bidDocuments.id,
      projectId: bidDocuments.projectId,
      createdBy: bidDocuments.createdBy,
      status: bidDocuments.status,
    })
    .from(bidDocuments)
    .where(eq(bidDocuments.id, documentId))
    .limit(1);

  return doc || null;
}

/**
 * 检查项目成员权限
 */
async function checkProjectMemberPermission(
  projectId: number,
  userId: number,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);

  if (!member) {
    // 检查是否是项目负责人
    const [project] = await db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project && project.ownerId === userId) {
      return { allowed: true };
    }

    return { allowed: false, reason: '您不是该项目的成员' };
  }

  // 根据成员权限检查
  const permissionMap: Record<PermissionAction, keyof typeof member> = {
    read: 'canView',
    edit: 'canEdit',
    delete: 'canEdit', // 删除需要编辑权限
  };

  const hasPermission = member[permissionMap[action]];
  if (hasPermission) {
    return { allowed: true };
  }

  return { 
    allowed: false, 
    reason: `您没有该项目的${action === 'read' ? '查看' : action === 'edit' ? '编辑' : '删除'}权限` 
  };
}

// ============================================
// 章节权限检查
// ============================================

/**
 * 检查用户对章节的权限
 */
export async function checkChapterPermission(
  userId: number,
  chapterId: number,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  // 获取章节信息
  const [chapter] = await db
    .select({
      id: bidChapters.id,
      documentId: bidChapters.documentId,
      assignedTo: bidChapters.assignedTo,
    })
    .from(bidChapters)
    .where(eq(bidChapters.id, chapterId))
    .limit(1);

  if (!chapter) {
    return { allowed: false, reason: '章节不存在' };
  }

  // 检查文档权限
  const docPermission = await checkDocumentPermission(userId, chapter.documentId, action);
  if (docPermission.allowed) {
    return { allowed: true };
  }

  // 如果是读取操作，检查是否是分配的编辑者
  if (action === 'read' || action === 'edit') {
    if (chapter.assignedTo === userId) {
      return { allowed: true };
    }
  }

  return docPermission;
}

// ============================================
// 文件权限检查
// ============================================

/**
 * 检查用户对文件的权限
 */
export async function checkFilePermission(
  userId: number,
  fileId: number,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  // 1. 检查是否有管理所有文件的权限
  const hasManagePermission = await hasPermission(userId, PERMISSION_CODES.FILE_MANAGE);
  if (hasManagePermission) {
    return { allowed: true };
  }

  // 2. 获取文件信息
  const [file] = await db
    .select({
      id: files.id,
      uploaderId: files.uploaderId,
      securityLevel: files.securityLevel,
      status: files.status,
    })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    return { allowed: false, reason: '文件不存在' };
  }

  // 3. 检查是否是上传者
  if (file.uploaderId === userId) {
    // 上传者默认有所有权限
    return { allowed: true };
  }

  // 4. 检查全局权限
  const globalPermissions: Record<PermissionAction, string> = {
    read: PERMISSION_CODES.FILE_READ,
    edit: PERMISSION_CODES.FILE_EDIT,
    delete: PERMISSION_CODES.FILE_DELETE,
  };

  const hasGlobalPermission = await hasPermission(userId, globalPermissions[action]);
  if (hasGlobalPermission) {
    // 检查安全级别访问权限
    const canAccessLevel = await checkSecurityLevelAccess(userId, file.securityLevel);
    if (!canAccessLevel) {
      return { allowed: false, reason: '您的权限级别不足以访问此文件' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: '权限不足' };
}

/**
 * 检查用户的安全级别访问权限
 */
async function checkSecurityLevelAccess(
  userId: number,
  securityLevel: string
): Promise<boolean> {
  // 获取用户的最高可访问密级
  const [member] = await db
    .select({ maxSecurityLevel: projectMembers.maxSecurityLevel })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .limit(1);

  if (!member) {
    // 非项目成员，只能访问公开文件
    return securityLevel === 'public';
  }

  const levels = ['public', 'internal', 'confidential', 'secret'];
  const userLevelIndex = levels.indexOf(member.maxSecurityLevel || 'internal');
  const fileLevelIndex = levels.indexOf(securityLevel);

  return fileLevelIndex <= userLevelIndex;
}

// ============================================
// 公司权限检查
// ============================================

/**
 * 检查用户对公司的权限
 */
export async function checkCompanyPermission(
  userId: number,
  companyId: number,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  // 1. 检查是否有管理所有公司的权限
  const hasManagePermission = await hasPermission(userId, PERMISSION_CODES.COMPANY_MANAGE);
  if (hasManagePermission) {
    return { allowed: true };
  }

  // 2. 获取公司信息
  const [company] = await db
    .select({
      id: companies.id,
      createdBy: companies.createdBy,
      isActive: companies.isActive,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    return { allowed: false, reason: '公司不存在' };
  }

  // 3. 检查是否是创建者
  if (company.createdBy === userId) {
    return { allowed: true };
  }

  // 4. 检查全局权限
  const globalPermissions: Record<PermissionAction, string> = {
    read: PERMISSION_CODES.COMPANY_READ,
    edit: PERMISSION_CODES.COMPANY_EDIT,
    delete: PERMISSION_CODES.COMPANY_DELETE,
  };

  const hasGlobalPermission = await hasPermission(userId, globalPermissions[action]);
  if (hasGlobalPermission) {
    return { allowed: true };
  }

  return { allowed: false, reason: '权限不足' };
}

// ============================================
// 公司文件权限检查
// ============================================

/**
 * 检查用户对公司文件的权限
 */
export async function checkCompanyFilePermission(
  userId: number,
  companyFileId: number,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  // 1. 获取公司文件信息
  const [companyFile] = await db
    .select({
      id: companyFiles.id,
      companyId: companyFiles.companyId,
      uploaderId: companyFiles.uploaderId,
      validTo: companyFiles.validTo,
    })
    .from(companyFiles)
    .where(eq(companyFiles.id, companyFileId))
    .limit(1);

  if (!companyFile) {
    return { allowed: false, reason: '公司文件不存在' };
  }

  // 2. 检查公司权限
  const companyPermission = await checkCompanyPermission(userId, companyFile.companyId, action);
  if (companyPermission.allowed) {
    return { allowed: true };
  }

  // 3. 检查是否是上传者
  if (companyFile.uploaderId === userId) {
    if (action === 'read' || action === 'edit') {
      return { allowed: true };
    }
    // 创建者可以删除自己上传的文件
    if (action === 'delete') {
      return { allowed: true };
    }
  }

  // 4. 检查全局公司文件权限
  const globalPermissions: Record<PermissionAction, string> = {
    read: PERMISSION_CODES.COMPANY_FILE_READ,
    edit: PERMISSION_CODES.COMPANY_FILE_EDIT,
    delete: PERMISSION_CODES.COMPANY_FILE_DELETE,
  };

  const hasGlobalPermission = await hasPermission(userId, globalPermissions[action]);
  if (hasGlobalPermission) {
    return { allowed: true };
  }

  return { allowed: false, reason: '权限不足' };
}

// ============================================
// 批量权限检查
// ============================================

/**
 * 批量检查用户对多个资源的权限
 */
export async function checkResourcePermissions(
  userId: number,
  resources: Array<{ type: ResourceType; id: number }>
): Promise<Map<string, ResourcePermission>> {
  const result = new Map<string, ResourcePermission>();

  for (const resource of resources) {
    const key = `${resource.type}:${resource.id}`;
    
    const [canRead, canEdit, canDelete] = await Promise.all([
      checkResourcePermission(userId, resource.type, resource.id, 'read'),
      checkResourcePermission(userId, resource.type, resource.id, 'edit'),
      checkResourcePermission(userId, resource.type, resource.id, 'delete'),
    ]);

    result.set(key, {
      resourceType: resource.type,
      resourceId: resource.id,
      canRead: canRead.allowed,
      canEdit: canEdit.allowed,
      canDelete: canDelete.allowed,
    });
  }

  return result;
}

/**
 * 统一资源权限检查
 */
export async function checkResourcePermission(
  userId: number,
  resourceType: ResourceType,
  resourceId: number,
  action: PermissionAction
): Promise<PermissionCheckResult> {
  switch (resourceType) {
    case 'document':
      return checkDocumentPermission(userId, resourceId, action);
    case 'chapter':
      return checkChapterPermission(userId, resourceId, action);
    case 'file':
      return checkFilePermission(userId, resourceId, action);
    case 'company':
      return checkCompanyPermission(userId, resourceId, action);
    case 'company_file':
      return checkCompanyFilePermission(userId, resourceId, action);
    default:
      return { allowed: false, reason: '未知的资源类型' };
  }
}

// ============================================
// 权限过滤工具
// ============================================

/**
 * 过滤用户有权访问的资源列表
 */
export async function filterAccessibleResources<T extends { id: number }>(
  userId: number,
  resourceType: ResourceType,
  resources: T[],
  action: PermissionAction = 'read'
): Promise<T[]> {
  const results: T[] = [];

  for (const resource of resources) {
    const permission = await checkResourcePermission(userId, resourceType, resource.id, action);
    if (permission.allowed) {
      results.push(resource);
    }
  }

  return results;
}

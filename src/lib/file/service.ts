/**
 * 文件服务
 * 提供文件上传、下载、管理等操作
 */

import { S3Storage } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { files, fileVersions, fileCategories, projectFiles, auditLogs } from '@/db/schema';
import { eq, and, like, desc, asc, inArray as _inArray, sql, count, isNull as _isNull } from 'drizzle-orm';
import { DocumentSecurityLevel } from '@/types/document';

// 初始化 S3 存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

// ============================================
// 类型定义
// ============================================

export interface FileUploadParams {
  fileContent: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
  categoryId?: number;
  securityLevel?: DocumentSecurityLevel;
  projectId?: number;
  fileType?: string;
  description?: string;
}

export interface FileQueryParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  securityLevel?: DocumentSecurityLevel;
  projectId?: number;
  uploaderId?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FileListItem {
  id: number;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  extension: string | null;
  categoryId: number | null;
  categoryName: string | null;
  securityLevel: DocumentSecurityLevel;
  currentVersion: number;
  uploaderId: number;
  uploaderName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  signedUrl?: string; // 临时访问URL
}

export interface FileDetail extends FileListItem {
  path: string;
  hash: string | null;
  versions: FileVersionItem[];
}

export interface FileVersionItem {
  id: number;
  version: number;
  size: number;
  hash: string | null;
  changeLog: string | null;
  uploaderId: number;
  uploaderName: string;
  createdAt: Date;
  signedUrl?: string;
}

// ============================================
// 文件服务函数
// ============================================

/**
 * 上传文件
 */
export async function uploadFile(
  params: FileUploadParams,
  userId: number
): Promise<number> {
  const {
    fileContent,
    fileName,
    mimeType,
    size,
    categoryId,
    securityLevel = 'internal',
    projectId,
    fileType,
    description,
  } = params;

  // 生成存储路径
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `uploads/${timestamp}_${sanitizedFileName}`;

  // 上传到对象存储
  const actualKey = await storage.uploadFile({
    fileContent,
    fileName: storagePath,
    contentType: mimeType,
  });

  // 计算文件哈希（用于去重）
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(fileContent).digest('hex');

  // 获取文件扩展名
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // 保存文件记录
  const result = await db
    .insert(files)
    .values({
      name: actualKey,
      originalName: fileName,
      path: actualKey,
      size,
      mimeType,
      extension,
      hash,
      categoryId: categoryId || null,
      securityLevel,
      currentVersion: 1,
      uploaderId: userId,
      status: 'active',
    })
    .returning({ id: files.id });

  const fileId = result[0].id;

  // 创建初始版本记录
  await db.insert(fileVersions).values({
    fileId,
    version: 1,
    path: actualKey,
    size,
    hash,
    changeLog: '初始版本',
    uploaderId: userId,
  });

  // 如果关联项目，创建项目文件关联
  if (projectId && fileType) {
    await db.insert(projectFiles).values({
      projectId,
      fileId,
      type: fileType,
      description,
      addedBy: userId,
    });
  }

  // 记录审计日志
  await db.insert(auditLogs).values({
    userId,
    action: 'upload',
    resource: 'file',
    resourceId: fileId,
    description: `上传文件: ${fileName}`,
  });

  return fileId;
}

/**
 * 获取文件列表
 */
export async function getFileList(
  params: FileQueryParams,
  _userId: number
): Promise<{ items: FileListItem[]; total: number }> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    categoryId,
    securityLevel,
    projectId: _projectId,
    uploaderId,
    status = 'active',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  // 构建查询条件
  const conditions = [eq(files.status, status)];

  if (keyword) {
    conditions.push(like(files.originalName, `%${keyword}%`));
  }

  if (categoryId) {
    conditions.push(eq(files.categoryId, categoryId));
  }

  if (securityLevel) {
    conditions.push(eq(files.securityLevel, securityLevel));
  }

  if (uploaderId) {
    conditions.push(eq(files.uploaderId, uploaderId));
  }

  // 排序
  const orderDirection = sortOrder === 'asc' ? asc : desc;
  let orderBy;
  switch (sortBy) {
    case 'name':
      orderBy = orderDirection(files.originalName);
      break;
    case 'size':
      orderBy = orderDirection(files.size);
      break;
    default:
      orderBy = orderDirection(files.createdAt);
  }

  // 查询总数
  const countResult = await db
    .select({ count: count() })
    .from(files)
    .where(and(...conditions));

  const total = countResult[0]?.count || 0;

  // 查询列表
  const result = await db
    .select({
      id: files.id,
      name: files.name,
      originalName: files.originalName,
      size: files.size,
      mimeType: files.mimeType,
      extension: files.extension,
      categoryId: files.categoryId,
      categoryName: fileCategories.name,
      securityLevel: files.securityLevel,
      currentVersion: files.currentVersion,
      uploaderId: files.uploaderId,
      uploaderName: sql<string>`${'users.real_name'}`,
      status: files.status,
      createdAt: files.createdAt,
      updatedAt: files.updatedAt,
    })
    .from(files)
    .leftJoin(fileCategories, eq(files.categoryId, fileCategories.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // 生成签名URL
  const items = await Promise.all(
    result.map(async (item) => {
      try {
        const signedUrl = await storage.generatePresignedUrl({
          key: item.name,
          expireTime: 3600, // 1小时有效
        });
        return { ...item, signedUrl } as FileListItem;
      } catch (_error) {
        return item as FileListItem;
      }
    })
  );

  return { items, total };
}

/**
 * 获取文件详情
 */
export async function getFileById(
  fileId: number,
  _userId: number
): Promise<FileDetail | null> {
  // 查询文件基本信息
  const fileResult = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (fileResult.length === 0) {
    return null;
  }

  const file = fileResult[0];

  // 查询文件版本
  const versions = await db
    .select({
      id: fileVersions.id,
      version: fileVersions.version,
      size: fileVersions.size,
      hash: fileVersions.hash,
      changeLog: fileVersions.changeLog,
      uploaderId: fileVersions.uploaderId,
      createdAt: fileVersions.createdAt,
    })
    .from(fileVersions)
    .where(eq(fileVersions.fileId, fileId))
    .orderBy(desc(fileVersions.version));

  // 生成当前版本签名URL
  let signedUrl: string | undefined;
  try {
    signedUrl = await storage.generatePresignedUrl({
      key: file.path,
      expireTime: 3600,
    });
  } catch (error) {
    console.error('Generate signed URL error:', error);
  }

  return {
    ...file,
    signedUrl,
    versions: versions as FileVersionItem[],
  } as FileDetail;
}

/**
 * 删除文件（软删除）
 */
export async function deleteFile(fileId: number, userId: number): Promise<boolean> {
  // 检查文件是否存在
  const existing = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('文件不存在');
  }

  // 软删除
  await db
    .update(files)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(eq(files.id, fileId));

  // 记录审计日志
  await db.insert(auditLogs).values({
    userId,
    action: 'delete',
    resource: 'file',
    resourceId: fileId,
    description: `删除文件: ${existing[0].originalName}`,
  });

  return true;
}

/**
 * 获取文件下载URL
 */
export async function getFileDownloadUrl(
  fileId: number,
  userId: number,
  expireTime: number = 3600
): Promise<{ url: string; fileName: string } | null> {
  // 查询文件
  const fileResult = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.status, 'active')))
    .limit(1);

  if (fileResult.length === 0) {
    return null;
  }

  const file = fileResult[0];

  // 生成签名URL
  const signedUrl = await storage.generatePresignedUrl({
    key: file.path,
    expireTime,
  });

  // 记录下载审计日志
  await db.insert(auditLogs).values({
    userId,
    action: 'download',
    resource: 'file',
    resourceId: fileId,
    description: `下载文件: ${file.originalName}`,
  });

  return {
    url: signedUrl,
    fileName: file.originalName,
  };
}

/**
 * 初始化文件分类
 */
export async function initFileCategories(): Promise<void> {
  // 检查是否已有分类
  const existing = await db.select().from(fileCategories).limit(1);

  if (existing.length > 0) {
    return;
  }

  // 插入默认分类
  const defaultCategories = [
    { name: '招标文件', code: 'tender_doc', category: 'tender_doc' },
    { name: '响应文件', code: 'response_doc', category: 'response_doc' },
    { name: '参考资料', code: 'reference', category: 'reference' },
    { name: '知识文档', code: 'knowledge', category: 'knowledge' },
    { name: '模板文件', code: 'template', category: 'template' },
    { name: '附件', code: 'attachment', category: 'attachment' },
  ];

  for (const cat of defaultCategories) {
    await db.insert(fileCategories).values({
      name: cat.name,
      code: cat.code,
      category: cat.category as any,
      sortOrder: 0,
    });
  }
}

/**
 * 获取文件分类列表
 */
export async function getFileCategories(): Promise<
  { id: number; name: string; code: string; category: string }[]
> {
  const categories = await db
    .select({
      id: fileCategories.id,
      name: fileCategories.name,
      code: fileCategories.code,
      category: fileCategories.category,
    })
    .from(fileCategories)
    .where(eq(fileCategories.isActive, true))
    .orderBy(sql`${fileCategories.sortOrder}`);

  return categories;
}

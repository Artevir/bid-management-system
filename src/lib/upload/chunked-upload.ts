/**
 * 大文件分片上传服务
 * 支持大文件的分片上传、断点续传、进度追踪
 */

import { mkdir, writeFile, readFile, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================
// 配置
// ============================================

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk
export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB max
export const TEMP_DIR = path.join(process.cwd(), 'temp', 'uploads');
export const SAFE_UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'chunked');

// ============================================
// 分片信息
// ============================================

export interface ChunkInfo {
  chunkNumber: number;
  chunkSize: number;
  totalChunks: number;
  fileSize: number;
  filename: string;
  fileHash: string;
  mimeType: string;
}

export interface UploadSession {
  sessionId: string;
  fileId: string;
  filename: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: Date;
  expiresAt: Date;
  tempDir: string;
}

export interface UploadProgress {
  sessionId: string;
  fileId: string;
  filename: string;
  totalChunks: number;
  uploadedChunks: number;
  progress: number; // 0-100
  status: 'uploading' | 'completed' | 'failed' | 'expired';
  uploadedSize: number;
  totalSize: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
}

// ============================================
// 上传会话管理
// ============================================

const uploadSessions = new Map<string, UploadSession>();

/**
 * 创建上传会话
 */
export async function createUploadSession(
  filename: string,
  fileSize: number,
  _mimeType: string
): Promise<UploadSession> {
  // 验证文件大小
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`文件大小超过限制（最大${MAX_FILE_SIZE / 1024 / 1024}MB）`);
  }

  // 计算分片数量
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  // 生成唯一标识
  const sessionId = crypto.randomUUID();
  const fileId = crypto.randomUUID();

  // 创建临时目录
  const tempDir = path.join(TEMP_DIR, sessionId);
  await mkdir(tempDir, { recursive: true });

  // 创建会话
  const session: UploadSession = {
    sessionId,
    fileId,
    filename,
    fileSize,
    totalChunks,
    uploadedChunks: [],
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    tempDir,
  };

  uploadSessions.set(sessionId, session);

  return session;
}

/**
 * 获取上传会话
 */
export function getUploadSession(sessionId: string): UploadSession | undefined {
  return uploadSessions.get(sessionId);
}

/**
 * 更新上传会话
 */
export function updateUploadSession(
  sessionId: string,
  updates: Partial<UploadSession>
): UploadSession | null {
  const session = uploadSessions.get(sessionId);
  if (!session) return null;

  const updated = { ...session, ...updates };
  uploadSessions.set(sessionId, updated);
  return updated;
}

/**
 * 删除上传会话
 */
export async function deleteUploadSession(sessionId: string): Promise<void> {
  const session = uploadSessions.get(sessionId);
  if (!session) return;

  // 清理临时目录
  try {
    await rm(session.tempDir, { recursive: true, force: true });
  } catch {
    // 忽略错误
  }

  uploadSessions.delete(sessionId);
}

// ============================================
// 分片上传
// ============================================

/**
 * 上传分片
 */
export async function uploadChunk(
  sessionId: string,
  chunkNumber: number,
  chunkData: Buffer,
  chunkHash: string
): Promise<{ success: boolean; message: string }> {
  const session = getUploadSession(sessionId);
  if (!session) {
    throw new Error('上传会话不存在');
  }

  // 验证分片编号
  if (chunkNumber < 1 || chunkNumber > session.totalChunks) {
    throw new Error('无效的分片编号');
  }

  // 验证是否已上传
  if (session.uploadedChunks.includes(chunkNumber)) {
    return { success: true, message: '分片已存在' };
  }
  if (!chunkHash) {
    throw new Error('缺少分片哈希');
  }

  const isHashValid = await verifyChunkHash(chunkData, chunkHash);
  if (!isHashValid) {
    throw new Error('分片哈希校验失败');
  }

  // 保存分片
  const chunkPath = path.join(session.tempDir, `chunk_${chunkNumber}`);
  await writeFile(chunkPath, chunkData);

  // 更新会话
  session.uploadedChunks.push(chunkNumber);
  uploadSessions.set(sessionId, session);

  return { success: true, message: '分片上传成功' };
}

/**
 * 验证文件完整性
 */
export async function verifyFileIntegrity(
  sessionId: string,
  expectedHash: string
): Promise<boolean> {
  const session = getUploadSession(sessionId);
  if (!session) return false;

  // 检查所有分片是否已上传
  if (session.uploadedChunks.length !== session.totalChunks) {
    return false;
  }

  // 合并文件并计算哈希
  const hash = crypto.createHash('sha256');

  for (let i = 1; i <= session.totalChunks; i++) {
    const chunkPath = path.join(session.tempDir, `chunk_${i}`);
    const chunkData = await readFile(chunkPath);
    hash.update(chunkData);
  }

  const actualHash = hash.digest('hex');

  return actualHash === expectedHash;
}

/**
 * 合并分片
 */
export async function mergeChunks(sessionId: string, targetPath: string): Promise<void> {
  const session = getUploadSession(sessionId);
  if (!session) {
    throw new Error('上传会话不存在');
  }

  const safeTargetPath = resolveSafeTargetPath(sessionId, session.filename, targetPath);

  // 确保目标目录存在
  const targetDir = path.dirname(safeTargetPath);
  await mkdir(targetDir, { recursive: true });

  // 合并分片
  await writeFile(safeTargetPath, Buffer.alloc(0));

  for (let i = 1; i <= session.totalChunks; i++) {
    const chunkPath = path.join(session.tempDir, `chunk_${i}`);
    const chunkData = await readFile(chunkPath);
    await writeFile(safeTargetPath, chunkData, { flag: 'a' });
    await unlink(chunkPath);
  }

  // 清理会话
  await deleteUploadSession(sessionId);
}

// ============================================
// 断点续传
// ============================================

/**
 * 获取已上传的分片列表
 */
export function getUploadedChunks(sessionId: string): number[] {
  const session = getUploadSession(sessionId);
  return session?.uploadedChunks || [];
}

/**
 * 计算上传进度
 */
export function getUploadProgress(sessionId: string): UploadProgress | null {
  const session = getUploadSession(sessionId);
  if (!session) return null;

  const uploadedSize = session.uploadedChunks.reduce(
    (acc, chunkNum) => acc + Math.min(CHUNK_SIZE, session.fileSize - (chunkNum - 1) * CHUNK_SIZE),
    0
  );

  const progress = (uploadedSize / session.fileSize) * 100;

  return {
    sessionId: session.sessionId,
    fileId: session.fileId,
    filename: session.filename,
    totalChunks: session.totalChunks,
    uploadedChunks: session.uploadedChunks.length,
    progress,
    status: progress === 100 ? 'completed' : 'uploading',
    uploadedSize,
    totalSize: session.fileSize,
    speed: 0, // 需要历史数据计算
    estimatedTimeRemaining: 0,
  };
}

// ============================================
// 文件清理
// ============================================

/**
 * 清理过期的上传会话
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date();
  const expiredSessions: string[] = [];

  for (const [sessionId, session] of uploadSessions.entries()) {
    if (session.expiresAt < now) {
      expiredSessions.push(sessionId);
    }
  }

  for (const sessionId of expiredSessions) {
    await deleteUploadSession(sessionId);
  }

  console.log(`Cleaned up ${expiredSessions.length} expired upload sessions`);
}

/**
 * 清理所有临时上传文件
 */
export async function cleanupAllTempFiles(): Promise<void> {
  try {
    if (existsSync(TEMP_DIR)) {
      await rm(TEMP_DIR, { recursive: true, force: true });
      await mkdir(TEMP_DIR, { recursive: true });
      console.log('Cleanup temp files directory done:', TEMP_DIR);
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 计算文件哈希
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

/**
 * 验证分片哈希
 */
export async function verifyChunkHash(chunkData: Buffer, expectedHash: string): Promise<boolean> {
  const hash = crypto.createHash('sha256');
  hash.update(chunkData);
  const actualHash = hash.digest('hex');
  return actualHash === expectedHash;
}

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename || 'file');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveSafeTargetPath(sessionId: string, filename: string, requestedPath?: string): string {
  const safeFilename = sanitizeFilename(filename);
  const safeBaseDir = path.join(SAFE_UPLOAD_ROOT, sessionId);
  const candidate = requestedPath
    ? path.join(safeBaseDir, sanitizeFilename(requestedPath))
    : path.join(safeBaseDir, safeFilename);
  const resolved = path.resolve(candidate);
  const safeRoot = path.resolve(SAFE_UPLOAD_ROOT);
  if (!resolved.startsWith(safeRoot + path.sep)) {
    throw new Error('非法目标路径');
  }
  return resolved;
}

// ============================================
// 定时清理任务
// ============================================

let cleanupScheduler: NodeJS.Timeout | null = null;

export function startUploadCleanupScheduler(): void {
  if (cleanupScheduler) return;
  cleanupScheduler = setInterval(
    () => {
      cleanupExpiredSessions();
    },
    60 * 60 * 1000
  );
}

export function stopUploadCleanupScheduler(): void {
  if (!cleanupScheduler) return;
  clearInterval(cleanupScheduler);
  cleanupScheduler = null;
}

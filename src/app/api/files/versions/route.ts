/**
 * 文件版本管理API
 * GET: 获取文件版本列表
 * POST: 版本操作（回滚、锁定等）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { files, fileVersions, auditLogs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

let storagePromise: Promise<{
  generatePresignedUrl: (params: { key: string; expireTime: number }) => Promise<string>;
} | null> | null = null;

async function getStorage() {
  if (!storagePromise) {
    storagePromise = (async () => {
      if (!process.env.COZE_BUCKET_ENDPOINT_URL || !process.env.COZE_BUCKET_NAME) {
        return null;
      }

      const { S3Storage } = await import('coze-coding-dev-sdk');
      return new S3Storage({
        endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
        accessKey: '',
        secretKey: '',
        bucketName: process.env.COZE_BUCKET_NAME,
        region: 'cn-beijing',
      });
    })();
  }

  return storagePromise;
}

// ============================================
// 类型定义
// ============================================

interface VersionInfo {
  id: number;
  version: number;
  size: number;
  hash: string | null;
  changeLog: string | null;
  isLocked: boolean;
  lockedBy: number | null;
  lockedAt: Date | null;
  lockReason: string | null;
  uploaderId: number;
  createdAt: Date;
  signedUrl?: string;
}

interface VersionCompareResult {
  version1: {
    version: number;
    size: number;
    hash: string | null;
    createdAt: Date;
  };
  version2: {
    version: number;
    size: number;
    hash: string | null;
    createdAt: Date;
  };
  sizeDiff: number;
  isIdentical: boolean;
}

// ============================================
// 获取版本列表
// ============================================

async function getVersions(request: NextRequest, _userId: number): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = parseInt(searchParams.get('fileId') || '0');

    if (!fileId) {
      return NextResponse.json({ error: '缺少文件ID' }, { status: 400 });
    }

    // 验证文件存在
    const file = await db.select().from(files).where(eq(files.id, fileId)).limit(1);

    if (file.length === 0) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 获取所有版本
    const versions = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.version));

    // 为每个版本生成签名URL
    const versionsWithUrl = await Promise.all(
      versions.map(async (v) => {
        let signedUrl: string | undefined;
        try {
          const storage = await getStorage();
          if (storage) {
            signedUrl = await storage.generatePresignedUrl({
              key: v.path,
              expireTime: 3600,
            });
          }
        } catch (e) {
          console.error('Generate signed URL error:', e);
        }

        return {
          ...v,
          signedUrl,
        } as VersionInfo;
      })
    );

    return NextResponse.json({
      file: {
        id: file[0].id,
        name: file[0].originalName,
        currentVersion: file[0].currentVersion,
      },
      versions: versionsWithUrl,
    });
  } catch (error) {
    console.error('Get file versions error:', error);
    return NextResponse.json({ error: '获取版本列表失败' }, { status: 500 });
  }
}

// ============================================
// 版本回滚
// ============================================

async function rollbackVersion(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { fileId, targetVersion, changeLog } = body;

    if (!fileId || !targetVersion) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 获取文件信息
    const file = await db.select().from(files).where(eq(files.id, fileId)).limit(1);

    if (file.length === 0) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 获取目标版本
    const targetVersionData = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, fileId), eq(fileVersions.version, targetVersion)))
      .limit(1);

    if (targetVersionData.length === 0) {
      return NextResponse.json({ error: '目标版本不存在' }, { status: 404 });
    }

    const target = targetVersionData[0];
    const newVersion = file[0].currentVersion + 1;

    // 创建新版本（指向目标版本的文件）
    await db.insert(fileVersions).values({
      fileId,
      version: newVersion,
      path: target.path,
      size: target.size,
      hash: target.hash,
      changeLog: changeLog || `回滚至版本 ${targetVersion}`,
      uploaderId: userId,
    });

    // 更新文件的当前版本
    await db
      .update(files)
      .set({
        currentVersion: newVersion,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));

    // 记录审计日志
    await db.insert(auditLogs).values({
      userId,
      action: 'rollback',
      resource: 'file_version',
      resourceId: fileId,
      description: `回滚文件 ${file[0].originalName} 至版本 ${targetVersion}`,
      requestParams: JSON.stringify({
        fromVersion: file[0].currentVersion,
        toVersion: targetVersion,
        newVersion,
      }),
    });

    return NextResponse.json({
      success: true,
      message: '版本回滚成功',
      newVersion,
    });
  } catch (error) {
    console.error('Rollback version error:', error);
    return NextResponse.json({ error: '版本回滚失败' }, { status: 500 });
  }
}

// ============================================
// 版本比较
// ============================================

async function compareVersions(request: NextRequest, _userId: number): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = parseInt(searchParams.get('fileId') || '0');
    const version1 = parseInt(searchParams.get('version1') || '0');
    const version2 = parseInt(searchParams.get('version2') || '0');

    if (!fileId || !version1 || !version2) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 获取两个版本
    const versions = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, fileId), eq(fileVersions.version, version1)));

    const versions2 = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, fileId), eq(fileVersions.version, version2)));

    if (versions.length === 0 || versions2.length === 0) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    const v1 = versions[0];
    const v2 = versions2[0];

    const result: VersionCompareResult = {
      version1: {
        version: v1.version,
        size: v1.size,
        hash: v1.hash,
        createdAt: v1.createdAt,
      },
      version2: {
        version: v2.version,
        size: v2.size,
        hash: v2.hash,
        createdAt: v2.createdAt,
      },
      sizeDiff: v2.size - v1.size,
      isIdentical: v1.hash === v2.hash && v1.hash !== null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Compare versions error:', error);
    return NextResponse.json({ error: '版本比较失败' }, { status: 500 });
  }
}

// ============================================
// 版本锁定
// ============================================

async function lockVersion(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { fileId, version, lockReason } = body;

    if (!fileId || !version) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 检查版本是否存在
    const existingVersion = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, fileId), eq(fileVersions.version, version)))
      .limit(1);

    if (existingVersion.length === 0) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    if (existingVersion[0].isLocked) {
      return NextResponse.json({ error: '该版本已被锁定' }, { status: 400 });
    }

    // 锁定版本
    await db
      .update(fileVersions)
      .set({
        isLocked: true,
        lockedBy: userId,
        lockedAt: new Date(),
        lockReason: lockReason || null,
      })
      .where(eq(fileVersions.id, existingVersion[0].id));

    // 记录审计日志
    await db.insert(auditLogs).values({
      userId,
      action: 'lock',
      resource: 'file_version',
      resourceId: fileId,
      description: `锁定文件版本 ${version}`,
      requestParams: JSON.stringify({ version, lockReason }),
    });

    return NextResponse.json({
      success: true,
      message: '版本锁定成功',
    });
  } catch (error) {
    console.error('Lock version error:', error);
    return NextResponse.json({ error: '版本锁定失败' }, { status: 500 });
  }
}

// ============================================
// 版本解锁
// ============================================

async function unlockVersion(request: NextRequest, userId: number): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { fileId, version } = body;

    if (!fileId || !version) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 检查版本是否存在
    const existingVersion = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, fileId), eq(fileVersions.version, version)))
      .limit(1);

    if (existingVersion.length === 0) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    if (!existingVersion[0].isLocked) {
      return NextResponse.json({ error: '该版本未被锁定' }, { status: 400 });
    }

    // 解锁版本
    await db
      .update(fileVersions)
      .set({
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        lockReason: null,
      })
      .where(eq(fileVersions.id, existingVersion[0].id));

    // 记录审计日志
    await db.insert(auditLogs).values({
      userId,
      action: 'unlock',
      resource: 'file_version',
      resourceId: fileId,
      description: `解锁文件版本 ${version}`,
      requestParams: JSON.stringify({ version }),
    });

    return NextResponse.json({
      success: true,
      message: '版本解锁成功',
    });
  } catch (error) {
    console.error('Unlock version error:', error);
    return NextResponse.json({ error: '版本解锁失败' }, { status: 500 });
  }
}

// ============================================
// 路由分发
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'compare') {
    return withAuth(request, compareVersions);
  }

  return withAuth(request, getVersions);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'rollback') {
    return withAuth(request, rollbackVersion);
  }

  if (action === 'lock') {
    return withAuth(request, lockVersion);
  }

  if (action === 'unlock') {
    return withAuth(request, unlockVersion);
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

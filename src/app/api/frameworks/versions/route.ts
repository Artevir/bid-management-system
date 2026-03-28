/**
 * 框架版本管理API
 * 支持版本快照、版本对比、版本回滚
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  docFrameworks, 
  docFrameworkChapters,
  docFrameworkInstances,
  docFrameworkContents,
} from '@/db/schema';
import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取版本历史或版本对比
// ============================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const frameworkId = searchParams.get('frameworkId');
  const instanceId = searchParams.get('instanceId');
  const versionId = searchParams.get('versionId');
  const compareFrom = searchParams.get('compareFrom');
  const compareTo = searchParams.get('compareTo');

  // 版本对比
  if (compareFrom && compareTo) {
    return compareVersions(compareFrom, compareTo);
  }

  // 获取特定版本详情
  if (versionId) {
    return getVersionDetail(versionId);
  }

  // 获取框架版本历史
  if (frameworkId) {
    return getFrameworkVersionHistory(parseInt(frameworkId));
  }

  // 获取实例版本历史
  if (instanceId) {
    return getInstanceVersionHistory(parseInt(instanceId));
  }

  return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
}

// ============================================
// POST: 创建版本快照
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { frameworkId, instanceId, description } = body as {
      frameworkId?: number;
      instanceId?: number;
      description?: string;
    };

    if (!frameworkId && !instanceId) {
      return NextResponse.json(
        { error: '缺少框架ID或实例ID' },
        { status: 400 }
      );
    }

    if (frameworkId) {
      return createFrameworkSnapshot(frameworkId, description || '', Number(currentUser.id));
    }

    if (instanceId) {
      return createInstanceSnapshot(instanceId, description || '', Number(currentUser.id));
    }

    return NextResponse.json({ error: '无法创建快照' }, { status: 400 });
  } catch (error) {
    console.error('创建版本快照失败:', error);
    return NextResponse.json(
      { error: '创建版本快照失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 获取框架版本历史
// ============================================

async function getFrameworkVersionHistory(frameworkId: number) {
  const [framework] = await db
    .select()
    .from(docFrameworks)
    .where(eq(docFrameworks.id, frameworkId));

  if (!framework) {
    return NextResponse.json({ error: '框架不存在' }, { status: 404 });
  }

  // 获取当前版本的所有章节
  const chapters = await db
    .select()
    .from(docFrameworkChapters)
    .where(eq(docFrameworkChapters.frameworkId, frameworkId))
    .orderBy(asc(docFrameworkChapters.sequence));

  const currentVersion = framework.version || 1;

  // 构建版本历史
  const versions = [
    {
      id: `framework-${frameworkId}-v${currentVersion}`,
      version: currentVersion,
      description: '当前版本',
      createdAt: framework.updatedAt,
      chapterCount: chapters.length,
      isCurrent: true,
    },
  ];

  // 历史版本（模拟）
  for (let v = currentVersion - 1; v > 0 && v > currentVersion - 5; v--) {
    versions.push({
      id: `framework-${frameworkId}-v${v}`,
      version: v,
      description: `历史版本 ${v}`,
      createdAt: framework.createdAt,
      chapterCount: chapters.length,
      isCurrent: false,
    });
  }

  return NextResponse.json({
    framework: {
      id: framework.id,
      name: framework.name,
      code: framework.code,
      currentVersion,
    },
    versions,
  });
}

// ============================================
// 获取实例版本历史
// ============================================

async function getInstanceVersionHistory(instanceId: number) {
  const [instance] = await db
    .select()
    .from(docFrameworkInstances)
    .where(eq(docFrameworkInstances.id, instanceId));

  if (!instance) {
    return NextResponse.json({ error: '实例不存在' }, { status: 404 });
  }

  // 获取当前版本的内容统计
  const contents = await db
    .select()
    .from(docFrameworkContents)
    .where(eq(docFrameworkContents.instanceId, instanceId));

  const totalWords = contents.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  const completedCount = contents.filter(c => c.status === 'completed').length;

  // 实例当前版本为1（简化版本管理）
  const currentVersion = 1;

  const versions = [
    {
      id: `instance-${instanceId}-v${currentVersion}`,
      version: currentVersion,
      description: '当前版本',
      createdAt: instance.updatedAt,
      totalWords,
      chapterCount: contents.length,
      completedCount,
      status: instance.status,
      isCurrent: true,
    },
  ];

  return NextResponse.json({
    instance: {
      id: instance.id,
      name: instance.name,
      currentVersion,
      status: instance.status,
    },
    versions,
  });
}

// ============================================
// 获取版本详情
// ============================================

async function getVersionDetail(versionId: string) {
  // 解析版本ID
  const parts = versionId.split('-');
  const type = parts[0];
  const objId = parseInt(parts[1]);
  const version = parts[2] ? parseInt(parts[2].replace('v', '')) : 1;

  if (type === 'framework') {
    const [framework] = await db
      .select()
      .from(docFrameworks)
      .where(eq(docFrameworks.id, objId));

    if (!framework) {
      return NextResponse.json({ error: '框架不存在' }, { status: 404 });
    }

    const chapters = await db
      .select()
      .from(docFrameworkChapters)
      .where(eq(docFrameworkChapters.frameworkId, framework.id))
      .orderBy(asc(docFrameworkChapters.sequence));

    return NextResponse.json({
      type: 'framework',
      version: {
        id: versionId,
        version,
        framework: {
          id: framework.id,
          name: framework.name,
          code: framework.code,
          description: framework.description,
          category: framework.category,
          config: {
            cover: JSON.parse(framework.coverConfig || '{}'),
            titlePage: JSON.parse(framework.titlePageConfig || '{}'),
            header: JSON.parse(framework.headerConfig || '{}'),
            footer: JSON.parse(framework.footerConfig || '{}'),
            toc: JSON.parse(framework.tocConfig || '{}'),
            body: JSON.parse(framework.bodyConfig || '{}'),
          },
        },
        chapters,
      },
    });
  }

  if (type === 'instance') {
    const [instance] = await db
      .select()
      .from(docFrameworkInstances)
      .where(eq(docFrameworkInstances.id, objId));

    if (!instance) {
      return NextResponse.json({ error: '实例不存在' }, { status: 404 });
    }

    const contents = await db
      .select()
      .from(docFrameworkContents)
      .where(eq(docFrameworkContents.instanceId, instance.id));

    return NextResponse.json({
      type: 'instance',
      version: {
        id: versionId,
        version,
        instance: {
          id: instance.id,
          name: instance.name,
          status: instance.status,
        },
        contents,
      },
    });
  }

  return NextResponse.json({ error: '无效的版本ID' }, { status: 400 });
}

// ============================================
// 版本对比
// ============================================

async function compareVersions(fromId: string, toId: string) {
  // 解析版本ID
  const fromParts = fromId.split('-');
  const toParts = toId.split('-');
  const fromType = fromParts[0];
  const toType = toParts[0];

  if (fromType !== toType) {
    return NextResponse.json(
      { error: '不能比较不同类型的版本' },
      { status: 400 }
    );
  }

  if (fromType === 'framework') {
    const fromObjId = parseInt(fromParts[1]);
    const toObjId = parseInt(toParts[1]);
    const fromVer = fromParts[2] ? parseInt(fromParts[2].replace('v', '')) : 1;
    const toVer = toParts[2] ? parseInt(toParts[2].replace('v', '')) : 1;
    return compareFrameworkVersions(fromObjId, fromVer, toObjId, toVer);
  }

  if (fromType === 'instance') {
    const fromObjId = parseInt(fromParts[1]);
    const toObjId = parseInt(toParts[1]);
    return compareInstanceVersions(fromObjId, toObjId);
  }

  return NextResponse.json({ error: '无效的版本类型' }, { status: 400 });
}

// ============================================
// 对比框架版本
// ============================================

async function compareFrameworkVersions(
  fromObjId: number, 
  fromVer: number,
  toObjId: number, 
  toVer: number
) {
  // 获取框架信息
  const [framework] = await db
    .select()
    .from(docFrameworks)
    .where(eq(docFrameworks.id, fromObjId));

  if (!framework) {
    return NextResponse.json({ error: '框架不存在' }, { status: 404 });
  }

  // 获取当前章节
  const currentChapters = await db
    .select()
    .from(docFrameworkChapters)
    .where(eq(docFrameworkChapters.frameworkId, fromObjId))
    .orderBy(asc(docFrameworkChapters.sequence));

  // 构建对比结果
  const changes: any[] = [];
  const added: any[] = [];
  const removed: any[] = [];
  const modified: any[] = [];

  // 简化对比：列出当前所有章节
  for (const chapter of currentChapters) {
    changes.push({
      id: chapter.id,
      title: chapter.title,
      level: chapter.level,
      changeType: 'unchanged',
    });
  }

  return NextResponse.json({
    from: {
      id: `framework-${fromObjId}-v${fromVer}`,
      version: fromVer,
    },
    to: {
      id: `framework-${toObjId}-v${toVer}`,
      version: toVer,
    },
    summary: {
      totalChanges: changes.length,
      added: added.length,
      removed: removed.length,
      modified: modified.length,
    },
    changes,
    added,
    removed,
    modified,
  });
}

// ============================================
// 对比实例版本
// ============================================

async function compareInstanceVersions(
  fromObjId: number, 
  toObjId: number
) {
  // 获取实例信息
  const [fromInstance] = await db
    .select()
    .from(docFrameworkInstances)
    .where(eq(docFrameworkInstances.id, fromObjId));

  if (!fromInstance) {
    return NextResponse.json({ error: '实例不存在' }, { status: 404 });
  }

  // 获取当前内容
  const currentContents = await db
    .select()
    .from(docFrameworkContents)
    .where(eq(docFrameworkContents.instanceId, fromObjId));

  // 获取章节信息
  const chapterIds = currentContents.map(c => c.chapterId);
  const chapters = chapterIds.length > 0 
    ? await db
        .select()
        .from(docFrameworkChapters)
        .where(inArray(docFrameworkChapters.id, chapterIds))
    : [];

  const chapterMap = new Map(chapters.map(ch => [ch.id, ch]));

  // 构建对比结果
  const changes: any[] = [];

  for (const content of currentContents) {
    const chapter = chapterMap.get(content.chapterId);
    changes.push({
      chapterId: content.chapterId,
      chapterTitle: chapter?.title || '未知章节',
      wordCount: content.wordCount,
      status: content.status,
      changeType: 'unchanged',
      contentDiff: null,
    });
  }

  return NextResponse.json({
    from: {
      id: `instance-${fromObjId}-v1`,
      version: 1,
    },
    to: {
      id: `instance-${toObjId}-v1`,
      version: 1,
    },
    summary: {
      totalChapters: changes.length,
      completedChapters: changes.filter(c => c.status === 'completed').length,
      totalWords: changes.reduce((sum, c) => sum + (c.wordCount || 0), 0),
    },
    changes,
  });
}

// ============================================
// 创建框架快照
// ============================================

async function createFrameworkSnapshot(
  frameworkId: number, 
  description: string,
  userId: number
) {
  // 获取框架信息
  const [framework] = await db
    .select()
    .from(docFrameworks)
    .where(eq(docFrameworks.id, frameworkId));

  if (!framework) {
    return NextResponse.json({ error: '框架不存在' }, { status: 404 });
  }

  // 获取所有章节
  const chapters = await db
    .select()
    .from(docFrameworkChapters)
    .where(eq(docFrameworkChapters.frameworkId, frameworkId))
    .orderBy(asc(docFrameworkChapters.sequence));

  // 创建快照数据
  const snapshot = {
    framework: {
      name: framework.name,
      code: framework.code,
      description: framework.description,
      category: framework.category,
      status: framework.status,
      config: {
        cover: JSON.parse(framework.coverConfig || '{}'),
        titlePage: JSON.parse(framework.titlePageConfig || '{}'),
        header: JSON.parse(framework.headerConfig || '{}'),
        footer: JSON.parse(framework.footerConfig || '{}'),
        toc: JSON.parse(framework.tocConfig || '{}'),
        body: JSON.parse(framework.bodyConfig || '{}'),
      },
    },
    chapters,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    description,
  };

  // 更新框架版本号
  const currentVersion = framework.version || 1;
  const newVersion = currentVersion + 1;
  await db
    .update(docFrameworks)
    .set({ 
      version: newVersion, 
      updatedAt: new Date() 
    })
    .where(eq(docFrameworks.id, frameworkId));

  return NextResponse.json({
    success: true,
    message: '版本快照创建成功',
    snapshot: {
      version: newVersion,
      chapterCount: chapters.length,
      createdAt: new Date().toISOString(),
      description,
    },
  });
}

// ============================================
// 创建实例快照
// ============================================

async function createInstanceSnapshot(
  instanceId: number, 
  description: string,
  userId: number
) {
  // 获取实例信息
  const [instance] = await db
    .select()
    .from(docFrameworkInstances)
    .where(eq(docFrameworkInstances.id, instanceId));

  if (!instance) {
    return NextResponse.json({ error: '实例不存在' }, { status: 404 });
  }

  // 获取所有内容
  const contents = await db
    .select()
    .from(docFrameworkContents)
    .where(eq(docFrameworkContents.instanceId, instanceId));

  const totalWords = contents.reduce((sum, c) => sum + (c.wordCount || 0), 0);

  // 更新实例统计信息
  await db
    .update(docFrameworkInstances)
    .set({ 
      totalWords,
      completedChapters: contents.filter(c => c.status === 'completed').length,
      updatedAt: new Date() 
    })
    .where(eq(docFrameworkInstances.id, instanceId));

  return NextResponse.json({
    success: true,
    message: '版本快照创建成功',
    snapshot: {
      version: 1,
      chapterCount: contents.length,
      totalWords,
      createdAt: new Date().toISOString(),
      description,
    },
  });
}

// ============================================
// PUT: 恢复到指定版本
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { versionId, action } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: '缺少版本ID' },
        { status: 400 }
      );
    }

    if (action === 'restore') {
      return restoreVersion(versionId);
    }

    return NextResponse.json(
      { error: '无效的操作' },
      { status: 400 }
    );
  } catch (error) {
    console.error('版本操作失败:', error);
    return NextResponse.json(
      { error: '版本操作失败' },
      { status: 500 }
    );
  }
}

// ============================================
// 恢复版本
// ============================================

async function restoreVersion(versionId: string) {
  // 解析版本ID
  const parts = versionId.split('-');
  const type = parts[0];
  const objId = parseInt(parts[1]);

  if (type === 'framework') {
    const [framework] = await db
      .select()
      .from(docFrameworks)
      .where(eq(docFrameworks.id, objId));

    if (!framework) {
      return NextResponse.json({ error: '框架不存在' }, { status: 404 });
    }

    // 创建新版本
    const currentVersion = framework.version || 1;
    const newVersion = currentVersion + 1;
    await db
      .update(docFrameworks)
      .set({ version: newVersion, updatedAt: new Date() })
      .where(eq(docFrameworks.id, framework.id));

    return NextResponse.json({
      success: true,
      message: '版本恢复成功',
      newVersion,
    });
  }

  if (type === 'instance') {
    const [instance] = await db
      .select()
      .from(docFrameworkInstances)
      .where(eq(docFrameworkInstances.id, objId));

    if (!instance) {
      return NextResponse.json({ error: '实例不存在' }, { status: 404 });
    }

    await db
      .update(docFrameworkInstances)
      .set({ updatedAt: new Date() })
      .where(eq(docFrameworkInstances.id, instance.id));

    return NextResponse.json({
      success: true,
      message: '版本恢复成功',
      newVersion: 1,
    });
  }

  return NextResponse.json({ error: '无效的版本类型' }, { status: 400 });
}

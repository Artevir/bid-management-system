/**
 * 标签版本历史API
 * 支持查看标签的历史版本和回滚
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { unifiedTags, tagVersions, users } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取标签版本历史
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: '无效的标签ID' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');

    // 获取版本历史
    const versions = await db
      .select({
        id: tagVersions.id,
        tagId: tagVersions.tagId,
        version: tagVersions.version,
        snapshot: tagVersions.snapshot,
        changeSummary: tagVersions.changeSummary,
        changedAt: tagVersions.changedAt,
        changer: {
          id: users.id,
          username: users.username,
          realName: users.realName,
        },
      })
      .from(tagVersions)
      .leftJoin(users, eq(tagVersions.changedBy, users.id))
      .where(eq(tagVersions.tagId, tagId))
      .orderBy(desc(tagVersions.version))
      .limit(limit);

    return NextResponse.json({ items: versions });
  } catch (error) {
    console.error('获取版本历史失败:', error);
    return NextResponse.json(
      { error: '获取版本历史失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建版本快照
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: '无效的标签ID' },
        { status: 400 }
      );
    }

    // 获取当前标签
    const [tag] = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.id, tagId));

    if (!tag) {
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 404 }
      );
    }

    // 获取当前最大版本号
    const versions = await db
      .select({ version: tagVersions.version })
      .from(tagVersions)
      .where(eq(tagVersions.tagId, tagId))
      .orderBy(desc(tagVersions.version))
      .limit(1);

    const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;

    const body = await request.json();
    const { changeSummary } = body;

    // 创建版本快照
    const [version] = await db
      .insert(tagVersions)
      .values({
        tagId,
        version: nextVersion,
        snapshot: JSON.stringify(tag),
        changeSummary: changeSummary || `版本 ${nextVersion}`,
        changedBy: currentUser.userId,
      })
      .returning();

    return NextResponse.json({ item: version });
  } catch (error) {
    console.error('创建版本快照失败:', error);
    return NextResponse.json(
      { error: '创建版本快照失败' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT: 回滚到指定版本
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: '无效的标签ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { targetVersion } = body;

    if (!targetVersion) {
      return NextResponse.json(
        { error: '缺少目标版本号' },
        { status: 400 }
      );
    }

    // 获取目标版本快照
    const [targetSnapshot] = await db
      .select()
      .from(tagVersions)
      .where(
        and(
          eq(tagVersions.tagId, tagId),
          eq(tagVersions.version, targetVersion)
        )
      );

    if (!targetSnapshot) {
      return NextResponse.json(
        { error: '目标版本不存在' },
        { status: 404 }
      );
    }

    // 获取当前标签
    const [currentTag] = await db
      .select()
      .from(unifiedTags)
      .where(eq(unifiedTags.id, tagId));

    if (!currentTag) {
      return NextResponse.json(
        { error: '标签不存在' },
        { status: 404 }
      );
    }

    // 创建当前状态快照
    const versions = await db
      .select({ version: tagVersions.version })
      .from(tagVersions)
      .where(eq(tagVersions.tagId, tagId))
      .orderBy(desc(tagVersions.version))
      .limit(1);

    const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1;

    await db.insert(tagVersions).values({
      tagId,
      version: nextVersion,
      snapshot: JSON.stringify(currentTag),
      changeSummary: `回滚前自动备份`,
      changedBy: currentUser.userId,
    });

    // 恢复目标版本
    const snapshot = JSON.parse(targetSnapshot.snapshot as string);
    
    const [restored] = await db
      .update(unifiedTags)
      .set({
        name: snapshot.name,
        code: snapshot.code,
        slug: snapshot.slug,
        categoryId: snapshot.categoryId,
        parentId: snapshot.parentId,
        type: snapshot.type,
        color: snapshot.color,
        icon: snapshot.icon,
        description: snapshot.description,
        entityTypes: snapshot.entityTypes,
        sortOrder: snapshot.sortOrder,
        isActive: snapshot.isActive,
        updatedAt: new Date(),
      })
      .where(eq(unifiedTags.id, tagId))
      .returning();

    // 创建回滚版本快照
    await db.insert(tagVersions).values({
      tagId,
      version: nextVersion + 1,
      snapshot: JSON.stringify(restored),
      changeSummary: `从版本 ${targetVersion} 回滚`,
      changedBy: currentUser.userId,
    });

    return NextResponse.json({ item: restored, message: `已回滚到版本 ${targetVersion}` });
  } catch (error) {
    console.error('回滚版本失败:', error);
    return NextResponse.json(
      { error: '回滚版本失败' },
      { status: 500 }
    );
  }
}

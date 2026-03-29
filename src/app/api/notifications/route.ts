/**
 * 通知API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/db';
import { notifications, users } from '@/db/schema';
import { eq, and, desc, sql, inArray, isNull as _isNull, ne as _ne } from 'drizzle-orm';

// 获取当前用户ID
async function getCurrentUserId(): Promise<number | null> {
  const session = await getSession();
  if (!session || !session.user) return null;
  return session.user.id;
}

// GET /api/notifications - 获取通知列表或统计信息
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // 获取统计信息
    if (action === 'stats') {
      const stats = await getNotificationStats(userId);
      return NextResponse.json(stats);
    }

    // 获取未读数量
    if (action === 'unreadCount') {
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      return NextResponse.json({ unreadCount: Number(count) });
    }

    // 获取通知列表
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const isRead = searchParams.get('isRead');

    const conditions = [eq(notifications.userId, userId)];
    
    if (type) {
      conditions.push(eq(notifications.type, type));
    }
    if (priority) {
      conditions.push(eq(notifications.priority, priority));
    }
    if (isRead !== null) {
      conditions.push(eq(notifications.isRead, isRead === 'true'));
    }

    const whereClause = and(...conditions);

    // 获取总数
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(whereClause);

    const total = Number(count);
    const totalPages = Math.ceil(total / pageSize);

    // 获取列表
    const offset = (page - 1) * pageSize;
    const list = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        content: notifications.content,
        priority: notifications.priority,
        link: notifications.link,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        senderId: notifications.senderId,
        senderName: users.realName,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.senderId, users.id))
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json({
      data: list,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error('获取通知失败:', error);
    return NextResponse.json({ error: '获取通知失败' }, { status: 500 });
  }
}

// POST /api/notifications - 创建通知
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      targetUserId, 
      type, 
      title, 
      content, 
      priority = 'normal',
      link,
      metadata,
      relatedType,
      relatedId,
    } = body;

    if (!targetUserId || !type || !title) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const [notification] = await db
      .insert(notifications)
      .values({
        userId: targetUserId,
        type,
        title,
        content: content || null,
        priority,
        link: link || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        senderId: userId,
        relatedType: relatedType || null,
        relatedId: relatedId || null,
        isRead: false,
      })
      .returning();

    return NextResponse.json(notification);
  } catch (error) {
    console.error('创建通知失败:', error);
    return NextResponse.json({ error: '创建通知失败' }, { status: 500 });
  }
}

// PUT /api/notifications - 更新通知状态
export async function PUT(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const { action, notificationId, notificationIds } = body;

    // 全部标记已读
    if (action === 'markAllRead') {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      
      return NextResponse.json({ success: true });
    }

    // 标记单条已读
    if (action === 'markRead' && notificationId) {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
      
      return NextResponse.json({ success: true });
    }

    // 批量标记已读
    if (notificationIds && Array.isArray(notificationIds)) {
      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          inArray(notifications.id, notificationIds),
          eq(notifications.userId, userId)
        ));
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('更新通知失败:', error);
    return NextResponse.json({ error: '更新通知失败' }, { status: 500 });
  }
}

// DELETE /api/notifications - 删除通知
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    // 清空已读通知
    if (action === 'clearRead') {
      await db
        .delete(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, true)));
      
      return NextResponse.json({ success: true });
    }

    // 删除单条通知
    if (id) {
      await db
        .delete(notifications)
        .where(and(eq(notifications.id, parseInt(id)), eq(notifications.userId, userId)));
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('删除通知失败:', error);
    return NextResponse.json({ error: '删除通知失败' }, { status: 500 });
  }
}

// 获取通知统计
async function getNotificationStats(userId: number) {
  const allNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const stats = {
    total: allNotifications.length,
    unread: allNotifications.filter(n => !n.isRead).length,
    byType: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
  };

  for (const n of allNotifications) {
    stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
    stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
  }

  return stats;
}

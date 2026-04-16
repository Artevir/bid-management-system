/**
 * 通知API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getUserRoles } from '@/lib/auth/permission';
import { db } from '@/db';
import { notifications, users } from '@/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { parseResourceId } from '@/lib/api/validators';

async function isAdminUser(userId: number): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.level === 0 || r.code === 'super_admin');
}

// GET /api/notifications - 获取通知列表或统计信息
export async function GET(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      if (action === 'stats') {
        const stats = await getNotificationStats(userId);
        return NextResponse.json(stats);
      }

      if (action === 'unreadCount') {
        const [{ count }] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
        return NextResponse.json({ unreadCount: Number(count) });
      }

      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20)
      );
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
      if (isRead !== null && isRead !== undefined && isRead !== '') {
        conditions.push(eq(notifications.isRead, isRead === 'true'));
      }

      const whereClause = and(...conditions);

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(notifications)
        .where(whereClause);

      const total = Number(count);
      const totalPages = Math.ceil(total / pageSize);

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
  });
}

// POST /api/notifications - 创建通知
export async function POST(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const body = await request.json();
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

      if (targetUserId == null || !type || !title) {
        return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
      }

      const targetId = parseResourceId(String(targetUserId), '目标用户');
      if (targetId !== userId && !(await isAdminUser(userId))) {
        return NextResponse.json(
          { error: '只能向自己发送通知，或需要管理员权限' },
          { status: 403 }
        );
      }

      const [notification] = await db
        .insert(notifications)
        .values({
          userId: targetId,
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
  });
}

// PUT /api/notifications - 更新通知状态
export async function PUT(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const body = await request.json();
      const { action, notificationId, notificationIds } = body;

      if (action === 'markAllRead') {
        await db
          .update(notifications)
          .set({ isRead: true, readAt: new Date() })
          .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

        return NextResponse.json({ success: true });
      }

      if (action === 'markRead' && notificationId != null) {
        const id = parseResourceId(String(notificationId), '通知');
        await db
          .update(notifications)
          .set({ isRead: true, readAt: new Date() })
          .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

        return NextResponse.json({ success: true });
      }

      if (notificationIds && Array.isArray(notificationIds)) {
        const ids = notificationIds
          .map((x: unknown) => {
            try {
              return parseResourceId(String(x), '通知');
            } catch {
              return null;
            }
          })
          .filter((x: number | null): x is number => x != null);

        if (ids.length === 0) {
          return NextResponse.json({ error: '无效的通知ID列表' }, { status: 400 });
        }

        await db
          .update(notifications)
          .set({ isRead: true, readAt: new Date() })
          .where(and(inArray(notifications.id, ids), eq(notifications.userId, userId)));

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    } catch (error) {
      console.error('更新通知失败:', error);
      return NextResponse.json({ error: '更新通知失败' }, { status: 500 });
    }
  });
}

// DELETE /api/notifications - 删除通知
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (request, userId) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');
      const idRaw = searchParams.get('id');

      if (action === 'clearRead') {
        await db
          .delete(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.isRead, true)));

        return NextResponse.json({ success: true });
      }

      if (idRaw) {
        const id = parseResourceId(idRaw, '通知');
        await db
          .delete(notifications)
          .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    } catch (error) {
      console.error('删除通知失败:', error);
      return NextResponse.json({ error: '删除通知失败' }, { status: 500 });
    }
  });
}

async function getNotificationStats(userId: number) {
  const allNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const stats = {
    total: allNotifications.length,
    unread: allNotifications.filter((n) => !n.isRead).length,
    byType: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
  };

  for (const n of allNotifications) {
    stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
    stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
  }

  return stats;
}

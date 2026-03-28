/**
 * 标签操作日志工具
 */

import { db } from '@/db';
import { operationLogs } from '@/db/schema';

/**
 * 记录操作日志
 */
export async function logOperation(data: {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  entityName?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(operationLogs).values({
      userId: data.userId || null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId || null,
      entityName: data.entityName || null,
      oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

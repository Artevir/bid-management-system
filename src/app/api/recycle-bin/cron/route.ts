/**
 * 回收站定时任务API
 * GET: 执行定时任务（自动清理过期资源、发送提醒）
 * 
 * 注意：此接口应该由外部定时任务服务调用，需要验证密钥
 */

import { NextRequest, NextResponse } from 'next/server';
import { processExpiredItems } from '@/lib/recycle-bin/service';

// 验证定时任务密钥
function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return true; // 如果没有配置密钥，允许执行（开发环境）
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

// 执行定时任务
export async function GET(request: NextRequest) {
  // 验证密钥
  if (!validateCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[Recycle Bin Cron] Starting scheduled task...');
    
    const result = await processExpiredItems();
    
    console.log(`[Recycle Bin Cron] Completed. Deleted: ${result.deletedCount}, Reminders sent: ${result.reminderSentCount}`);
    
    return NextResponse.json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        reminderSentCount: result.reminderSentCount,
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Recycle Bin Cron] Error:', error);
    return NextResponse.json(
      { error: '定时任务执行失败' },
      { status: 500 }
    );
  }
}

// 也支持POST请求
export async function POST(request: NextRequest) {
  return GET(request);
}

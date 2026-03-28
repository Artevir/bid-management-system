/**
 * 预警触发API
 * 用于手动触发预警检查或作为定时任务调用
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  sendPendingAlerts,
  generateAlertsForTender,
} from '@/lib/tender-subscription/service';
import { batchExtractTimeNodes } from '@/lib/tender-subscription/time-extraction';
import { db } from '@/db';
import { tenderInfos } from '@/db/schema';
import { eq, isNull, and, gt } from 'drizzle-orm';

// POST /api/tender-alerts/trigger - 触发预警检查
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    switch (action) {
      case 'extract-time-nodes': {
        // 提取时间节点
        const result = await batchExtractTimeNodes({
          limit: body.limit || 20,
          onlyMissing: body.onlyMissing ?? true,
        });
        return NextResponse.json({
          success: true,
          message: `时间节点提取完成：成功${result.success}个，失败${result.failed}个`,
          total: result.total,
          extracted: result.success,
          failed: result.failed,
        });
      }

      case 'generate-alerts': {
        // 为所有招标信息生成预警
        const tenders = await db
          .select()
          .from(tenderInfos)
          .where(
            and(
              gt(tenderInfos.submissionDeadline, new Date()),
              eq(tenderInfos.isDuplicate, false)
            )
          )
          .limit(100);

        let generated = 0;
        for (const tender of tenders) {
          try {
            const alerts = await generateAlertsForTender(tender.id);
            generated += alerts.length;
          } catch (error) {
            console.error(`生成预警失败 [${tender.id}]:`, error);
          }
        }

        return NextResponse.json({
          success: true,
          message: `预警生成完成：处理${tenders.length}条招标信息，生成${generated}条预警`,
          tenderCount: tenders.length,
          alertCount: generated,
        });
      }

      case 'send-alerts': {
        // 发送待发送的预警
        const result = await sendPendingAlerts();
        return NextResponse.json({
          success: true,
          message: `预警发送完成：成功${result.sent}条，失败${result.failed}条`,
          ...result,
        });
      }

      case 'full-check': {
        // 完整检查流程
        // 1. 提取时间节点
        const extractResult = await batchExtractTimeNodes({
          limit: 20,
          onlyMissing: true,
        });

        // 2. 生成预警
        const tenders = await db
          .select()
          .from(tenderInfos)
          .where(
            and(
              gt(tenderInfos.submissionDeadline, new Date()),
              eq(tenderInfos.isDuplicate, false)
            )
          )
          .limit(50);

        let generated = 0;
        for (const tender of tenders) {
          try {
            const alerts = await generateAlertsForTender(tender.id);
            generated += alerts.length;
          } catch (error) {
            console.error(`生成预警失败 [${tender.id}]:`, error);
          }
        }

        // 3. 发送预警
        const sendResult = await sendPendingAlerts();

        return NextResponse.json({
          success: true,
          message: '完整检查完成',
          extract: extractResult,
          generate: { tenderCount: tenders.length, alertCount: generated },
          send: sendResult,
        });
      }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('预警触发失败:', error);
    return NextResponse.json({ error: '预警触发失败' }, { status: 500 });
  }
}

// GET /api/tender-alerts/trigger - 获取预警统计信息
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;

    if (searchParams.get('action') === 'stats') {
      // 获取统计信息
      const now = new Date();
      const tenders = await db.select().from(tenderInfos);
      const activeTenders = tenders.filter(
        t => t.submissionDeadline && new Date(t.submissionDeadline) > now
      );
      const missingTimeNodes = tenders.filter(t => !t.submissionDeadline);

      return NextResponse.json({
        totalTenders: tenders.length,
        activeTenders: activeTenders.length,
        missingTimeNodes: missingTimeNodes.length,
        lastCheck: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return NextResponse.json({ error: '获取统计信息失败' }, { status: 500 });
  }
}

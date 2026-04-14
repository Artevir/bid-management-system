/**
 * 流式解析API
 * POST: 流式解析文档，实时返回进度
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { comprehensiveParse } from '@/lib/parse/extractors';
import { db } from '@/db';
import { parseTasks, parseItems, parseResults } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// 流式解析文档
async function streamParse(
  request: NextRequest,
  userId: number
): Promise<Response> {
  try {
    const body = await request.json();
    const { taskId, documentContent } = body;

    if (!taskId || !documentContent) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    // 获取任务信息
    const task = await db
      .select()
      .from(parseTasks)
      .where(eq(parseTasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json({ error: '解析任务不存在' }, { status: 404 });
    }
    if (task[0].createdBy !== userId) {
      return NextResponse.json({ error: '无权访问该解析任务' }, { status: 403 });
    }
    if (task[0].status === 'processing') {
      return NextResponse.json({ error: '解析任务正在处理中，请勿重复提交' }, { status: 409 });
    }
    if (task[0].status === 'completed') {
      return NextResponse.json({ error: '解析任务已完成，请直接查看结果' }, { status: 409 });
    }

    // 提取请求头
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (step: string, progress: number) => {
          const data = JSON.stringify({ type: 'progress', step, progress });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const sendResult = (result: any) => {
          const data = JSON.stringify({ type: 'result', data: result });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const sendError = (error: string) => {
          const data = JSON.stringify({ type: 'error', error });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        const sendComplete = () => {
          const data = JSON.stringify({ type: 'complete' });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
        };

        try {
          // 原子切换任务状态，避免并发重复执行
          const started = await db
            .update(parseTasks)
            .set({ status: 'processing', startedAt: new Date() })
            .where(
              and(
                eq(parseTasks.id, taskId),
                inArray(parseTasks.status, ['pending', 'failed'])
              )
            )
            .returning({ id: parseTasks.id });

          if (started.length === 0) {
            sendError('任务状态已变更，请刷新后重试');
            controller.close();
            return;
          }

          // 幂等重试时先清空旧结果，避免重复写入
          await db.delete(parseItems).where(eq(parseItems.taskId, taskId));
          await db.delete(parseResults).where(eq(parseResults.taskId, taskId));

          // 执行综合解析
          const result = await comprehensiveParse(
            documentContent,
            sendProgress,
            customHeaders
          );

          // 保存解析结果到数据库
          sendProgress('保存解析结果', 80);

          // 保存章节
          for (const section of result.sections) {
            await saveSection(taskId, section);
          }

          // 保存时间节点
          for (const item of result.deadlines.items) {
            await db.insert(parseItems).values({
              taskId,
              type: 'deadline',
              title: item.title,
              content: item.content,
              originalText: item.originalText,
              confidence: item.confidence,
              isLowConfidence: item.confidence < 80,
              extraData: JSON.stringify(item.extraData),
            });
          }

          // 保存资格条件
          for (const item of result.qualifications.items) {
            await db.insert(parseItems).values({
              taskId,
              type: 'qualification',
              title: item.title,
              content: item.content,
              originalText: item.originalText,
              confidence: item.confidence,
              isLowConfidence: item.confidence < 80,
              extraData: JSON.stringify(item.extraData),
            });
          }

          // 保存评分项
          for (const item of result.scoringItems.items) {
            await db.insert(parseItems).values({
              taskId,
              type: 'scoring_item',
              title: item.title,
              content: item.content,
              originalText: item.originalText,
              confidence: item.confidence,
              isLowConfidence: item.confidence < 80,
              extraData: JSON.stringify(item.extraData),
            });
          }

          // 更新任务状态为完成
          await db
            .update(parseTasks)
            .set({
              status: 'completed',
              progress: 100,
              completedAt: new Date(),
            })
            .where(eq(parseTasks.id, taskId));

          // 发送结果
          sendResult(result);
          sendComplete();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '解析失败';
          
          // 更新任务状态为失败
          await db
            .update(parseTasks)
            .set({
              status: 'failed',
              errorMessage,
              completedAt: new Date(),
            })
            .where(eq(parseTasks.id, taskId));

          sendError(errorMessage);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Stream parse error:', error);
    return NextResponse.json({ error: '流式解析失败' }, { status: 500 });
  }
}

// 递归保存章节
async function saveSection(
  taskId: number,
  section: any,
  _parentId?: number
): Promise<void> {
  const [result] = await db
    .insert(parseResults)
    .values({
      taskId,
      sectionTitle: section.title,
      sectionType: section.type,
      content: section.content,
      pageNumber: section.pageNumber,
      confidence: 100,
    })
    .returning({ id: parseResults.id });

  if (section.children && section.children.length > 0) {
    for (const child of section.children) {
      await saveSection(taskId, child, result.id);
    }
  }
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => streamParse(req, userId));
}

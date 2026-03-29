/**
 * 流式解析API
 * POST: 流式解析文档，实时返回进度
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth as _withAuth } from '@/lib/auth/middleware';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { comprehensiveParse } from '@/lib/parse/extractors';
import { db } from '@/db';
import { parseTasks, parseItems, parseResults } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 流式解析文档
async function streamParse(
  request: NextRequest,
  _userId: number
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
          // 更新任务状态为处理中
          await db
            .update(parseTasks)
            .set({ status: 'processing', startedAt: new Date() })
            .where(eq(parseTasks.id, taskId));

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
  // 流式API需要直接处理，不能使用withAuth中间件
  // TODO: 在函数内部进行认证检查
  try {
    const userId = 1; // 临时处理，实际需要从session获取
    return await streamParse(request, userId);
  } catch (error) {
    console.error('Stream parse error:', error);
    return NextResponse.json({ error: '流式解析失败' }, { status: 500 });
  }
}

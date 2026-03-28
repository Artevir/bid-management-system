/**
 * 解析任务详情API
 * GET: 获取解析任务详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getParseTask, executeParseTask } from '@/lib/parse/service';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { db } from '@/db';
import { files } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 获取解析任务详情
async function getTaskDetail(
  request: NextRequest,
  userId: number,
  taskId: number
): Promise<NextResponse> {
  try {
    const task = await getParseTask(taskId);

    if (!task) {
      return NextResponse.json({ error: '解析任务不存在' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Get parse task detail error:', error);
    return NextResponse.json({ error: '获取解析任务详情失败' }, { status: 500 });
  }
}

// 执行解析任务
async function executeTask(
  request: NextRequest,
  userId: number,
  taskId: number
): Promise<NextResponse> {
  try {
    // 获取任务详情
    const task = await getParseTask(taskId);

    if (!task) {
      return NextResponse.json({ error: '解析任务不存在' }, { status: 404 });
    }

    if (task.status === 'processing') {
      return NextResponse.json({ error: '任务正在处理中' }, { status: 400 });
    }

    if (task.status === 'completed') {
      return NextResponse.json({ error: '任务已完成' }, { status: 400 });
    }

    // 获取文件内容（这里简化处理，实际需要读取文件内容）
    // 由于文件存储在对象存储中，需要先获取文件内容
    const fileRecord = await db
      .select()
      .from(files)
      .where(eq(files.id, task.fileId))
      .limit(1);

    if (fileRecord.length === 0) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }

    // 提取请求头用于LLM调用
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 这里简化处理，实际应该读取文件内容
    // 对于演示，我们使用一个示例文本
    const documentContent = `招标文件示例内容

第一章 招标公告

一、项目基本情况
项目名称：XXX信息化建设项目
招标编号：XXX-2024-001

二、投标截止时间
投标文件递交截止时间：2024年3月15日上午9:00
开标时间：2024年3月15日上午9:30

三、投标人资格要求
1. 具有独立承担民事责任的能力
2. 具有良好的商业信誉和健全的财务会计制度
3. 具有履行合同所必需的设备和专业技术能力
4. 参加本次采购活动前三年内，在经营活动中没有重大违法记录

四、评分标准
技术评分（60分）：
- 技术方案（30分）
- 项目实施方案（20分）
- 售后服务方案（10分）

商务评分（40分）：
- 报价（30分）
- 企业资质（10分）
`;

    // 异步执行解析（实际项目中应该使用队列）
    executeParseTask(taskId, documentContent, customHeaders).catch(console.error);

    return NextResponse.json({
      success: true,
      message: '解析任务已启动',
      taskId,
    });
  } catch (error) {
    console.error('Execute parse task error:', error);
    return NextResponse.json({ error: '执行解析任务失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getTaskDetail(req, userId, parseInt(id)));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => executeTask(req, userId, parseInt(id)));
}

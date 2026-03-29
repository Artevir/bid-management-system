/**
 * 智能审校API
 * POST: 执行文档审校（支持流式和非流式）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { HeaderUtils, LLMClient, Config } from 'coze-coding-dev-sdk';
import { reviewDocument, ReviewType } from '@/lib/bid/reviewer';
import { db } from '@/db';
import { documentReviews, complianceChecks, bidChapters, bidDocuments } from '@/db/schema';
import { eq, and as _and } from 'drizzle-orm';
import { createStreamResponse } from '@/lib/stream-utils';

// ============================================
// 流式审校
// ============================================

async function executeReviewStream(
  request: NextRequest,
  _userId: number
): Promise<Response> {
  try {
    const body = await request.json();
    const { documentId, types } = body;

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    const reviewTypes: ReviewType[] = types || ['compliance', 'format', 'content', 'completeness'];
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 获取文档和章节信息
    const doc = await db
      .select()
      .from(bidDocuments)
      .where(eq(bidDocuments.id, documentId))
      .limit(1);

    if (doc.length === 0) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    const chapters = await db
      .select()
      .from(bidChapters)
      .where(eq(bidChapters.documentId, documentId));

    return createStreamResponse(async (controller, encoder) => {
      const allIssues: any[] = [];
      let totalProgress = 0;
      const totalSteps = chapters.length * reviewTypes.length;

      // 发送开始信号
      controller.enqueue(encoder.encode({
        type: 'start',
        totalSteps,
        documentName: doc[0]?.name,
      }));

      for (const type of reviewTypes) {
        controller.enqueue(encoder.encode({
          type: 'phase',
          phase: type,
          phaseName: {
            compliance: '合规检查',
            format: '格式检查',
            content: '内容检查',
            completeness: '完整性检查',
          }[type],
        }));

        for (const chapter of chapters) {
          if (!chapter.content || chapter.content.length < 50) {
            totalProgress++;
            continue;
          }

          try {
            const config = new Config();
            const client = new LLMClient(config, customHeaders as any);

            const systemPrompt = getReviewPrompt(type);

            const response = await client.invoke(
              [
                { role: 'system', content: systemPrompt },
                {
                  role: 'user',
                  content: `章节：${chapter.title}\n\n内容：\n${chapter.content.substring(0, 2000)}`,
                },
              ],
              {
                model: 'doubao-seed-1-8-251228',
                temperature: 0.3,
              }
            );

            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const chapterIssues = JSON.parse(jsonMatch[0]);
              chapterIssues.forEach((issue: any, index: number) => {
                const newIssue = {
                  id: `${type}-${chapter.id}-${index}`,
                  type: issue.type,
                  location: {
                    chapterId: chapter.id,
                    chapterTitle: chapter.title,
                  },
                  message: issue.message,
                  suggestion: issue.suggestion,
                  severity: issue.severity,
                };
                allIssues.push(newIssue);
                
                // 实时发送每个问题
                controller.enqueue(encoder.encode({
                  type: 'issue',
                  issue: newIssue,
                }));
              });
            }
          } catch (error) {
            console.error(`Review chapter ${chapter.id} error:`, error);
          }

          totalProgress++;
          controller.enqueue(encoder.encode({
            type: 'progress',
            progress: Math.round((totalProgress / totalSteps) * 100),
          }));
        }
      }

      // 计算统计结果
      const statistics = {
        total: allIssues.length,
        errors: allIssues.filter((i) => i.type === 'error').length,
        warnings: allIssues.filter((i) => i.type === 'warning').length,
        infos: allIssues.filter((i) => i.type === 'info').length,
      };

      const score = Math.max(0, 100 - statistics.errors * 10 - statistics.warnings * 3 - statistics.infos);

      // 保存审校结果
      await db.insert(documentReviews).values({
        documentId,
        type: 'compliance',
        score,
        result: JSON.stringify({ statistics }),
        issues: JSON.stringify(allIssues),
        status: 'completed',
        reviewedAt: new Date(),
      });

      // 发送完成信号
      controller.enqueue(encoder.encode({
        type: 'complete',
        result: {
          score,
          passed: statistics.errors === 0,
          statistics,
          issues: allIssues,
        },
      }));
    });
  } catch (error) {
    console.error('Execute review stream error:', error);
    return NextResponse.json({ error: '执行审校失败' }, { status: 500 });
  }
}

// 获取审校提示词
function getReviewPrompt(type: ReviewType): string {
  const prompts: Record<ReviewType, string> = {
    compliance: `你是一个标书合规审核专家。请检查内容是否符合招标文件的合规要求。

检查项目：
1. 是否包含法律禁止的内容
2. 是否存在歧视性条款
3. 是否符合招标文件格式要求
4. 是否存在明显的矛盾或错误
5. 关键信息是否准确完整

返回JSON数组格式的问题列表：[{"type":"error|warning|info","message":"问题描述","suggestion":"修改建议","severity":"critical|major|minor"}]`,

    format: `你是一个标书格式审核专家。请检查内容的格式规范性。

检查项目：
1. 标题层级是否清晰
2. 段落格式是否规范
3. 表格、列表是否正确
4. 标点符号使用是否正确
5. 数字、单位格式是否统一

返回JSON数组格式的问题列表：[{"type":"error|warning|info","message":"问题描述","suggestion":"修改建议","severity":"critical|major|minor"}]`,

    content: `你是一个标书内容审核专家。请检查内容的完整性和专业性。

检查项目：
1. 内容是否完整、有逻辑性
2. 是否存在拼写错误或语法问题
3. 数据和参数是否准确
4. 是否存在空洞、无实际内容的表述
5. 技术方案是否合理可行

返回JSON数组格式的问题列表：[{"type":"error|warning|info","message":"问题描述","suggestion":"修改建议","severity":"critical|major|minor"}]`,

    completeness: `你是一个标书完整性审核专家。请检查章节内容是否完整。

检查项目：
1. 必填章节是否完整
2. 内容长度是否合理
3. 是否遗漏关键信息
4. 是否符合招标文件要求

返回JSON数组格式的问题列表：[{"type":"error|warning|info","message":"问题描述","suggestion":"修改建议","severity":"critical|major|minor"}]`,
  };

  return prompts[type];
}

// ============================================
// 非流式审校（保留向后兼容）
// ============================================

async function executeReview(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { documentId, types } = body;

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    const reviewTypes: ReviewType[] = types || ['compliance', 'format', 'content', 'completeness'];
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const result = await reviewDocument(documentId, reviewTypes, customHeaders);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Execute review error:', error);
    return NextResponse.json({ error: '执行审校失败' }, { status: 500 });
  }
}

// ============================================
// 获取审校历史
// ============================================

async function getReviewHistory(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    const reviews = await db
      .select()
      .from(documentReviews)
      .where(eq(documentReviews.documentId, parseInt(documentId)))
      .orderBy(documentReviews.createdAt);

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        ...r,
        result: r.result ? JSON.parse(r.result) : null,
        issues: r.issues ? JSON.parse(r.issues) : null,
      })),
    });
  } catch (error) {
    console.error('Get review history error:', error);
    return NextResponse.json({ error: '获取审校历史失败' }, { status: 500 });
  }
}

// ============================================
// 获取合规检查结果
// ============================================

async function getComplianceResults(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: '缺少文档ID' }, { status: 400 });
    }

    const checks = await db
      .select()
      .from(complianceChecks)
      .where(eq(complianceChecks.documentId, parseInt(documentId)));

    // 统计
    const statistics = {
      total: checks.length,
      passed: checks.filter((c) => c.result === 'pass').length,
      failed: checks.filter((c) => c.result === 'fail').length,
      warnings: checks.filter((c) => c.result === 'warning').length,
      resolved: checks.filter((c) => c.isResolved).length,
    };

    return NextResponse.json({
      checks,
      statistics,
    });
  } catch (error) {
    console.error('Get compliance results error:', error);
    return NextResponse.json({ error: '获取合规检查结果失败' }, { status: 500 });
  }
}

// ============================================
// 解决合规问题
// ============================================

async function resolveComplianceIssue(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { checkId } = body;

    if (!checkId) {
      return NextResponse.json({ error: '缺少检查ID' }, { status: 400 });
    }

    await db
      .update(complianceChecks)
      .set({
        isResolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(eq(complianceChecks.id, checkId));

    return NextResponse.json({
      success: true,
      message: '问题已标记为解决',
    });
  } catch (error) {
    console.error('Resolve compliance issue error:', error);
    return NextResponse.json({ error: '解决问题失败' }, { status: 500 });
  }
}

// ============================================
// 路由分发
// ============================================

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const stream = searchParams.get('stream') === 'true';

  switch (action) {
    case 'compliance':
      return withAuth(request, (req, userId) => getComplianceResults(req, userId));
    case 'resolve':
      return withAuth(request, (req, userId) => resolveComplianceIssue(req, userId));
    default:
      if (stream) {
        try {
          const userId = 1; // TODO: 从session获取
          return await executeReviewStream(request, userId);
        } catch (_error) {
          return NextResponse.json({ error: '执行审校失败' }, { status: 500 });
        }
      }
      return withAuth(request, (req, userId) => executeReview(req, userId));
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getReviewHistory(req, userId));
}

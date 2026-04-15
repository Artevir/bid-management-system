import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  smartReviewDocuments,
  smartResponseItems,
  smartResponseMatrix,
} from '@/db/smart-review-schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getLLM } from '@/lib/llm';
import { deriveSegmentsAndRequirements } from '@/lib/smart-review/assets';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const documentId = parseInt(id);

    if (isNaN(documentId)) {
      return NextResponse.json({ error: '无效的文档ID' }, { status: 400 });
    }

    const [document] = await db
      .select()
      .from(smartReviewDocuments)
      .where(eq(smartReviewDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    if (document.status !== 'uploading' && document.status !== 'parsed') {
      return NextResponse.json({ error: '文档状态不允许解析' }, { status: 400 });
    }

    // 更新状态为解析中
    await db
      .update(smartReviewDocuments)
      .set({
        status: 'parsing',
        parseStartedAt: new Date(),
        parseProgress: 0,
      })
      .where(eq(smartReviewDocuments.id, documentId));

    const startTime = Date.now();

    try {
      // 调用AI进行文档解析
      const llm = getLLM();

      const systemPrompt = `你是一个专业的招标文件分析专家。你的任务是从招标文件中提取结构化信息。

请从以下招标文件中提取关键信息，并以JSON格式返回：

1. basicInfo (项目基本信息)
   - projectName: 项目名称
   - projectCode: 项目编号
   - tenderOrganization: 招标单位
   - tenderAgent: 招标代理机构
   - projectBudget: 项目预算
   - tenderMethod: 招标方式
   - tenderScope: 招标范围
   - projectLocation: 项目地点
   - projectOverview: 项目概述
   - fundSource: 资金来源

2. feeInfo (费用信息)
   - documentFee: 招标文件费用
   - documentFeeDeadline: 招标文件截止时间
   - bidBond: 投标保证金金额
   - bidBondMethod: 保证金缴纳方式
   - bidBondDeadline: 保证金截止时间
   - performanceBond: 履约保证金

3. timeNodes (关键时间节点)
   - name: 节点名称
   - time: 时间
   - location: 地点（可选）

4. submissionRequirements (投标提交要求)
   - requirement: 要求内容
   - copies: 份数

5. technicalSpecs (技术规格要求)
   - category: 分类
   - name: 名称/参数
   - requirement: 要求描述
   - unit: 单位（可选）

6. scoringItems (评分细则)
   - category: 分类
   - itemName: 评分项名称
   - score: 分值
   - criteria: 评分标准

7. framework (文档框架)
   - chapter: 章节号
   - title: 章节标题
   - pageNum: 页码（可选）

请确保返回的JSON格式规范，如果某项信息在文档中未找到，请返回空数组或null。`;

      const userPrompt = `请分析以下招标文件并提取结构化信息：
      
文件名称：${document.fileName}
文件URL：${document.fileUrl}

请以JSON格式返回提取的信息。`;

      const result = await llm.generate([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(result.content);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
        parsedData = { rawContent: result.content };
      }

      const parseDuration = Date.now() - startTime;

      // 更新文档解析结果
      const [updated] = await db
        .update(smartReviewDocuments)
        .set({
          status: 'parsed',
          parseProgress: 100,
          parseCompletedAt: new Date(),
          parseDuration,
          basicInfo: parsedData.basicInfo || null,
          feeInfo: parsedData.feeInfo || null,
          timeNodes: parsedData.timeNodes || null,
          submissionRequirements: parsedData.submissionRequirements || null,
          technicalSpecs: parsedData.technicalSpecs || null,
          scoringItems: parsedData.scoringItems || null,
          qualificationRequirements: parsedData.qualificationRequirements || null,
          framework: parsedData.framework || null,
          specCount: parsedData.technicalSpecs?.length || 0,
          scoringCount: parsedData.scoringItems?.length || 0,
          chapterCount: parsedData.framework?.length || 0,
          extractionAccuracy: parsedData.extractionAccuracy || 85,
          aiModel: result.model || 'unknown',
          updatedAt: new Date(),
        })
        .where(eq(smartReviewDocuments.id, documentId))
        .returning();

      const { requirements } = deriveSegmentsAndRequirements(updated);
      if (requirements.length > 0) {
        const [existingMatrix] = await db
          .select()
          .from(smartResponseMatrix)
          .where(
            and(
              eq(smartResponseMatrix.documentId, documentId),
              eq(smartResponseMatrix.matrixName, '要求资产主链路')
            )
          )
          .limit(1);

        const matrix =
          existingMatrix ??
          (
            await db
              .insert(smartResponseMatrix)
              .values({
                documentId,
                matrixName: '要求资产主链路',
                totalItems: 0,
                respondedItems: 0,
                matchRate: 0,
                status: 'completed',
                generatedBy: currentUser.username,
                generatedAt: new Date(),
              })
              .returning()
          )[0];

        await db.delete(smartResponseItems).where(eq(smartResponseItems.matrixId, matrix.id));
        await db.insert(smartResponseItems).values(
          requirements.map((item) => ({
            matrixId: matrix.id,
            documentId,
            requirementCategory: item.category,
            requirementItem: item.item,
            requirementSource: `${item.source}|segment:${item.segmentId}`,
            responseSource: JSON.stringify({
              segmentId: item.segmentId,
              source: item.source,
              confidence: item.confidence,
              isMandatory: item.isMandatory,
            }),
            responseContent: item.detail,
            confidence: item.confidence,
            status: 'pending',
          }))
        );
        await db
          .update(smartResponseMatrix)
          .set({
            totalItems: requirements.length,
            respondedItems: 0,
            matchRate: 0,
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(smartResponseMatrix.id, matrix.id));
      }

      return NextResponse.json({
        message: '文档解析成功',
        document: updated,
        parsedData,
      });
    } catch (parseError: any) {
      // 解析失败，更新状态
      await db
        .update(smartReviewDocuments)
        .set({
          status: 'parsed',
          parseProgress: 0,
          parseError: parseError.message || '解析失败',
        })
        .where(eq(smartReviewDocuments.id, documentId));

      return NextResponse.json(
        { error: '文档解析失败', details: parseError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Parse smart review document error:', error);
    return NextResponse.json({ error: '解析文档失败' }, { status: 500 });
  }
}

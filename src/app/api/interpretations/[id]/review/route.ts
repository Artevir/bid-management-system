/**
 * 招标文件解读审核API
 * POST: 审核解读结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { db } from '@/db';
import { bidDocumentInterpretations, bidInterpretationLogs, notifications, users, auditLogs } from '@/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';

interface ReviewParams {
  action: 'approve' | 'reject';
  accuracy: number;
  comment: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const interpretationId = parseInt(id);

    if (isNaN(interpretationId)) {
      return NextResponse.json({ error: '无效的ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action, accuracy, comment } = body as ReviewParams;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '无效的审核动作' }, { status: 400 });
    }

    // 检查解读是否存在
    const interpretation = await db
      .select()
      .from(bidDocumentInterpretations)
      .where(eq(bidDocumentInterpretations.id, interpretationId))
      .limit(1);

    if (interpretation.length === 0) {
      return NextResponse.json({ error: '解读记录不存在' }, { status: 404 });
    }

    const interp = interpretation[0];
    
    // 只能审核已完成的解读
    if (interp.status !== 'completed') {
      return NextResponse.json({ error: '只能审核已完成的解读' }, { status: 400 });
    }

    // 获取当前级别和需要级别
    const currentLevel = interp.currentApprovalLevel || 1;
    const requiredLevel = interp.approvalLevelRequired || 1;
    
    let newLevel = currentLevel;
    let reviewStatus = interp.reviewStatus;
    
    if (action === 'reject') {
      // 驳回直接结束
      reviewStatus = 'rejected';
      newLevel = -1;
    } else if (action === 'approve') {
      if (currentLevel < requiredLevel) {
        // 继续下一级审核
        newLevel = currentLevel + 1;
        reviewStatus = 'pending';
      } else {
        // 最终通过
        reviewStatus = 'approved';
      }
    }

    // 更新审核状态
    await db
      .update(bidDocumentInterpretations)
      .set({
        reviewStatus,
        reviewerId: user.userId,
        reviewedAt: new Date(),
        reviewComment: comment || null,
        reviewAccuracy: accuracy || interp.extractAccuracy,
        currentApprovalLevel: newLevel,
      })
      .where(eq(bidDocumentInterpretations.id, interpretationId));

    // 记录审核日志
    const logContent = action === 'reject' 
      ? `审核驳回（${currentLevel}级）` 
      : currentLevel < requiredLevel 
        ? `审核通过（${currentLevel}级），进入下一级审核`
        : '审核通过（终审）';
    
    await db.insert(bidInterpretationLogs).values({
      interpretationId,
      operatorId: user.userId,
      operationType: 'review',
      operationContent: logContent,
      operationTime: new Date(),
    });

    // 发送审核通知
    try {
      if (reviewStatus === 'approved' && currentLevel >= requiredLevel) {
        // 最终通过，通知上传人
        const uploader = await db
          .select({ userId: bidDocumentInterpretations.uploaderId })
          .from(bidDocumentInterpretations)
          .where(eq(bidDocumentInterpretations.id, interpretationId))
          .limit(1);
        
        if (uploader[0]?.uploaderId) {
          await db.insert(notifications).values({
            userId: uploader[0].uploaderId,
            type: 'interpretation_review',
            title: '解读审核通过',
            content: `招标文件《${interp.documentName}》已通过审核`,
            link: `/interpretations/${interpretationId}`,
            relatedType: 'interpretation',
            relatedId: interpretationId,
          });
        }
      } else if (reviewStatus === 'rejected') {
        // 驳回，通知上传人
        const uploader = await db
          .select({ userId: bidDocumentInterpretations.uploaderId })
          .from(bidDocumentInterpretations)
          .where(eq(bidDocumentInterpretations.id, interpretationId))
          .limit(1);
        
        if (uploader[0]?.uploaderId) {
          await db.insert(notifications).values({
            userId: uploader[0].uploaderId,
            type: 'interpretation_review',
            title: '解读审核驳回',
            content: `招标文件《${interp.documentName}》审核未通过：${comment || '请查看详情'}`,
            link: `/interpretations/${interpretationId}`,
            relatedType: 'interpretation',
            relatedId: interpretationId,
            priority: 'high',
          });
        }
      } else if (reviewStatus === 'pending' && newLevel > 1) {
        // 进入下一级审核，通知相关人员（这里简化处理，通知所有有审核权限的用户）
        const reviewers = await db
          .select({ id: users.id })
          .from(users)
          .limit(5);
        
        for (const reviewer of reviewers) {
          await db.insert(notifications).values({
            userId: reviewer.id,
            type: 'interpretation_review',
            title: '新的解读待审核',
            content: `招标文件《${interp.documentName}》需要第${newLevel}级审核`,
            link: `/approval/interpretations`,
            relatedType: 'interpretation',
            relatedId: interpretationId,
          });
        }
      }
    } catch (notifyError) {
      console.error('发送通知失败:', notifyError);
    }

    // 记录审计日志
    try {
      await db.insert(auditLogs).values({
        userId: user.userId,
        username: user.username,
        action: action === 'approve' ? 'approve' : 'reject',
        resource: 'interpretation_review',
        resourceId: interpretationId,
        resourceCode: interp.documentName,
        description: `审核${interp.documentName}：${action === 'approve' ? '通过' : '驳回'}，级别${currentLevel}`,
        requestPath: `/api/interpretations/${interpretationId}/review`,
        requestMethod: 'POST',
        responseStatus: 200,
        duration: 0,
      });
    } catch (auditError) {
      console.error('记录审计日志失败:', auditError);
    }

    // 返回不同状态
    if (reviewStatus === 'pending') {
      return NextResponse.json({
        success: true,
        message: `审核通过，进入第${newLevel}级审核`,
        needNextLevel: true,
        currentLevel: newLevel,
        requiredLevel,
      });
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '审核通过' : '审核驳回',
      reviewStatus,
    });
  } catch (error) {
    console.error('审核解读失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '审核失败' },
      { status: 500 }
    );
  }
}
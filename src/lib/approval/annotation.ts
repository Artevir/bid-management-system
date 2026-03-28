/**
 * 审核批注服务
 * 实现审核意见、批注标记、问题闭环管理
 */

import { db } from '@/db';
import { approvalRecords, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================
// 类型定义
// ============================================

export interface Annotation {
  id: number;
  nodeId: number;
  recordId: number;
  userId: number;
  username: string;
  type: 'comment' | 'issue' | 'suggestion';
  content: string;
  position?: {
    sectionId?: string;
    startOffset?: number;
    endOffset?: number;
    pageNumber?: number;
  };
  status: 'open' | 'resolved' | 'dismissed';
  resolvedBy?: number;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnnotationParams {
  nodeId: number;
  recordId: number;
  type: 'comment' | 'issue' | 'suggestion';
  content: string;
  position?: {
    sectionId?: string;
    startOffset?: number;
    endOffset?: number;
    pageNumber?: number;
  };
}

// ============================================
// 批注服务
// ============================================

/**
 * 获取审核节点的批注列表
 */
export async function getNodeAnnotations(nodeId: number) {
  // 注意：这里假设有一个annotations表
  // 实际实现中需要创建该表或在approvalRecords表中存储
  // 这里简化实现，返回模拟数据
  return [];
}

/**
 * 创建批注
 */
export async function createAnnotation(
  userId: number,
  params: CreateAnnotationParams
): Promise<Annotation> {
  // 在实际实现中，这里应该将批注保存到数据库
  // 简化实现，返回模拟数据
  const annotation: Annotation = {
    id: Date.now(),
    nodeId: params.nodeId,
    recordId: params.recordId,
    userId,
    username: 'User',
    type: params.type,
    content: params.content,
    position: params.position,
    status: 'open',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return annotation;
}

/**
 * 解决批注问题
 */
export async function resolveAnnotation(
  annotationId: number,
  userId: number
): Promise<void> {
  // 更新批注状态为已解决
  console.log(`Annotation ${annotationId} resolved by user ${userId}`);
}

/**
 * 忽略批注问题
 */
export async function dismissAnnotation(
  annotationId: number,
  userId: number
): Promise<void> {
  // 更新批注状态为已忽略
  console.log(`Annotation ${annotationId} dismissed by user ${userId}`);
}

// ============================================
// 问题闭环服务
// ============================================

/**
 * 获取项目的问题列表
 */
export async function getProjectIssues(projectId: number) {
  // 查询所有未解决的批注问题
  // 实际实现需要关联项目表
  return [];
}

/**
 * 批量解决问题
 */
export async function batchResolveIssues(
  issueIds: number[],
  userId: number
): Promise<void> {
  for (const id of issueIds) {
    await resolveAnnotation(id, userId);
  }
}

/**
 * 获取问题统计
 */
export async function getIssueStats(projectId: number) {
  return {
    total: 0,
    open: 0,
    resolved: 0,
    dismissed: 0,
    byType: {
      comment: 0,
      issue: 0,
      suggestion: 0,
    },
  };
}

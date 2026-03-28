/**
 * 批量操作 API
 */

import { NextRequest, NextResponse } from 'next/server';
import BatchOperationService, { BatchOperationType } from '@/lib/batch/batch-operation-service';

// ============================================
// GET - 获取批量操作状态
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const taskId = searchParams.get('taskId');
    const userId = searchParams.get('userId');

    if (taskId) {
      // 获取单个任务状态
      const task = await BatchOperationService.getTaskStatus(taskId);
      if (!task) {
        return NextResponse.json({
          success: false,
          error: '任务不存在',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: task,
      });
    } else {
      // 获取所有活动任务
      const activeTasks = await BatchOperationService.getActiveTasks(userId || undefined);
      
      return NextResponse.json({
        success: true,
        data: activeTasks,
      });
    }
  } catch (error) {
    console.error('[Batch API] 请求失败:', error);
    return NextResponse.json({
      success: false,
      error: '请求失败',
    }, { status: 500 });
  }
}

// ============================================
// POST - 创建批量操作
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, resourceType, ids, updateData, options } = body;

    if (!type || !resourceType || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: '缺少必填参数：type, resourceType, ids',
      }, { status: 400 });
    }

    if (!options || !options.userId) {
      return NextResponse.json({
        success: false,
        error: '缺少 userId',
      }, { status: 400 });
    }

    let taskId: string;

    switch (type) {
      case BatchOperationType.BATCH_DELETE:
        taskId = await BatchOperationService.batchDelete(resourceType, ids, options);
        break;

      case BatchOperationType.BATCH_UPDATE:
        taskId = await BatchOperationService.batchUpdate(resourceType, ids, updateData || {}, options);
        break;

      case BatchOperationType.BATCH_APPROVE:
        taskId = await BatchOperationService.batchApprove(resourceType, ids, options);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `不支持的操作类型: ${type}`,
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: { taskId },
      message: '批量操作已启动',
    });
  } catch (error) {
    console.error('[Batch API] 创建批量操作失败:', error);
    return NextResponse.json({
      success: false,
      error: '创建批量操作失败',
    }, { status: 500 });
  }
}

// ============================================
// DELETE - 取消批量操作
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '缺少 taskId 参数',
      }, { status: 400 });
    }

    const cancelled = await BatchOperationService.cancelTask(taskId);

    if (!cancelled) {
      return NextResponse.json({
        success: false,
        error: '任务不存在或无法取消',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '批量操作已取消',
    });
  } catch (error) {
    console.error('[Batch API] 取消批量操作失败:', error);
    return NextResponse.json({
      success: false,
      error: '取消批量操作失败',
    }, { status: 500 });
  }
}

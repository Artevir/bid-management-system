/**
 * 索引管理 API 路由
 * 提供数据库索引的管理和监控功能
 */

import { NextRequest, NextResponse } from 'next/server';
import IndexManager from '@/lib/db/index-manager';

// ============================================
// GET - 获取索引统计信息
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';

    // 获取索引统计信息
    if (action === 'stats') {
      const stats = await IndexManager.getIndexStats();
      return NextResponse.json({
        success: true,
        data: stats
      });
    }

    // 获取慢查询建议
    if (action === 'slow-queries') {
      const suggestions = await IndexManager.getSlowQuerySuggestions();
      return NextResponse.json({
        success: true,
        data: suggestions
      });
    }

    // 获取表统计信息
    if (action === 'table-stats') {
      const tableStats = await IndexManager.getTableStats();
      return NextResponse.json({
        success: true,
        data: tableStats
      });
    }

    return NextResponse.json({
      success: false,
      error: '未知的操作'
    }, { status: 400 });

  } catch (error) {
    console.error('[Index API] 请求失败:', error);
    return NextResponse.json({
      success: false,
      error: '请求失败'
    }, { status: 500 });
  }
}

// ============================================
// POST - 执行索引操作
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // 执行索引迁移
    if (action === 'migrate') {
      const result = await IndexManager.runMigration();
      return NextResponse.json(result);
    }

    // 分析表统计信息
    if (action === 'analyze') {
      const { tables } = body;
      const result = await IndexManager.analyzeTables(tables);
      return NextResponse.json(result);
    }

    // 清理死元组
    if (action === 'vacuum') {
      const { tables } = body;
      const result = await IndexManager.vacuumTables(tables);
      return NextResponse.json(result);
    }

    // 重建索引
    if (action === 'reindex') {
      const { indexName } = body;
      if (!indexName) {
        return NextResponse.json({
          success: false,
          error: '缺少 indexName 参数'
        }, { status: 400 });
      }
      const result = await IndexManager.reindex(indexName);
      return NextResponse.json(result);
    }

    // 删除未使用的索引
    if (action === 'drop-unused') {
      const result = await IndexManager.dropUnusedIndexes();
      return NextResponse.json(result);
    }

    return NextResponse.json({
      success: false,
      error: '未知的操作'
    }, { status: 400 });

  } catch (error) {
    console.error('[Index API] 请求失败:', error);
    return NextResponse.json({
      success: false,
      error: '请求失败'
    }, { status: 500 });
  }
}

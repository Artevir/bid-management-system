/**
 * 数据库索引管理服务
 * 用于管理和维护数据库索引
 */

import { db } from '@/db/index';
import { sql } from 'drizzle-orm';

// ============================================
// 索引信息接口
// ============================================

export interface IndexInfo {
  schemaName: string;
  tableName: string;
  indexName: string;
  indexSize: string;
  indexScans: number;
  tuplesRead: number;
  tuplesFetched: number;
}

export interface IndexStats {
  totalIndexes: number;
  totalSize: string;
  unusedIndexes: IndexInfo[];
  mostUsedIndexes: IndexInfo[];
  largestIndexes: IndexInfo[];
}

// ============================================
// 索引管理服务类
// ============================================

export class IndexManager {
  /**
   * 执行索引优化迁移
   */
  static async runMigration(): Promise<{ success: boolean; message: string }> {
    try {
      // 读取迁移SQL文件
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(process.cwd(), 'migrations', '0001_add_performance_indexes.sql');
      
      if (!fs.existsSync(migrationPath)) {
        return {
          success: false,
          message: '迁移文件不存在'
        };
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      // 分割SQL语句（按分号分隔，过滤空行和注释）
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      // 执行每条SQL语句
      for (const statement of statements) {
        try {
          await db.execute(sql.raw(statement));
          console.log(`[Index] 执行成功: ${statement.substring(0, 50)}...`);
        } catch (error) {
          console.warn(`[Index] 执行失败（可能已存在）: ${error}`);
          // 继续执行下一条，不中断整个迁移
        }
      }

      return {
        success: true,
        message: '索引迁移执行完成'
      };
    } catch (error) {
      console.error('[Index] 迁移执行失败:', error);
      return {
        success: false,
        message: `迁移执行失败: ${error}`
      };
    }
  }

  /**
   * 获取所有索引统计信息
   */
  static async getIndexStats(): Promise<IndexStats> {
    try {
      // 获取所有索引信息
      const indexes = await db.execute(sql`
        SELECT
          schemaname AS "schemaName",
          tablename AS "tableName",
          indexname AS "indexName",
          pg_size_pretty(pg_relation_size(indexrelid)) AS "indexSize",
          idx_scan AS "indexScans",
          idx_tup_read AS "tuplesRead",
          idx_tup_fetch AS "tuplesFetched"
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `);

      const allIndexes = indexes.rows || [];

      // 计算总大小
      const totalSize = await db.execute(sql`
        SELECT pg_size_pretty(sum(pg_relation_size(indexrelid))) AS "totalSize"
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
      `);

      // 查找未使用的索引
      const unusedIndexes = allIndexes.filter((idx: any) => 
        idx.indexScans === 0 && !idx.indexName.includes('_pkey')
      );

      // 获取最常用的索引
      const mostUsedIndexes = [...allIndexes]
        .sort((a: any, b: any) => b.indexScans - a.indexScans)
        .slice(0, 10);

      // 获取最大的索引
      const largestIndexesResult = await db.execute(sql`
        SELECT
          schemaname AS "schemaName",
          tablename AS "tableName",
          indexname AS "indexName",
          pg_size_pretty(pg_relation_size(indexrelid)) AS "indexSize",
          idx_scan AS "indexScans",
          idx_tup_read AS "tuplesRead",
          idx_tup_fetch AS "tuplesFetched"
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 10
      `);

      return {
        totalIndexes: allIndexes.length,
        totalSize: totalSize.rows[0]?.totalSize || '0 B',
        unusedIndexes: unusedIndexes as IndexInfo[],
        mostUsedIndexes: mostUsedIndexes as IndexInfo[],
        largestIndexes: largestIndexesResult.rows as IndexInfo[],
      };
    } catch (error) {
      console.error('[Index] 获取索引统计失败:', error);
      throw error;
    }
  }

  /**
   * 分析表统计信息
   */
  static async analyzeTables(tables: string[] = []): Promise<{ success: boolean; message: string }> {
    try {
      // 如果未指定表，则分析所有表
      if (tables.length === 0) {
        await db.execute(sql`ANALYZE`);
        return {
          success: true,
          message: '已分析所有表的统计信息'
        };
      }

      // 分析指定的表
      for (const table of tables) {
        await db.execute(sql.raw(`ANALYZE ${table}`));
      }

      return {
        success: true,
        message: `已分析表: ${tables.join(', ')}`
      };
    } catch (error) {
      console.error('[Index] 分析表失败:', error);
      return {
        success: false,
        message: `分析表失败: ${error}`
      };
    }
  }

  /**
   * 清理死元组
   */
  static async vacuumTables(tables: string[] = []): Promise<{ success: boolean; message: string }> {
    try {
      // 如果未指定表，则清理所有表
      if (tables.length === 0) {
        await db.execute(sql`VACUUM ANALYZE`);
        return {
          success: true,
          message: '已清理所有表的死元组'
        };
      }

      // 清理指定的表
      for (const table of tables) {
        await db.execute(sql.raw(`VACUUM ANALYZE ${table}`));
      }

      return {
        success: true,
        message: `已清理表: ${tables.join(', ')}`
      };
    } catch (error) {
      console.error('[Index] 清理死元组失败:', error);
      return {
        success: false,
        message: `清理死元组失败: ${error}`
      };
    }
  }

  /**
   * 重建索引
   */
  static async reindex(indexName: string): Promise<{ success: boolean; message: string }> {
    try {
      await db.execute(sql.raw(`REINDEX INDEX ${indexName}`));
      return {
        success: true,
        message: `索引 ${indexName} 重建成功`
      };
    } catch (error) {
      console.error('[Index] 重建索引失败:', error);
      return {
        success: false,
        message: `重建索引 ${indexName} 失败: ${error}`
      };
    }
  }

  /**
   * 删除未使用的索引
   */
  static async dropUnusedIndexes(): Promise<{ success: boolean; droppedIndexes: string[]; message: string }> {
    try {
      const stats = await this.getIndexStats();
      const droppedIndexes: string[] = [];

      // 删除未使用的主键索引以外的索引
      for (const index of stats.unusedIndexes) {
        try {
          await db.execute(sql.raw(`DROP INDEX IF EXISTS ${index.indexName}`));
          droppedIndexes.push(index.indexName);
          console.log(`[Index] 删除未使用的索引: ${index.indexName}`);
        } catch (error) {
          console.warn(`[Index] 删除索引失败 ${index.indexName}:`, error);
        }
      }

      return {
        success: true,
        droppedIndexes,
        message: `已删除 ${droppedIndexes.length} 个未使用的索引`
      };
    } catch (error) {
      console.error('[Index] 删除未使用索引失败:', error);
      return {
        success: false,
        droppedIndexes: [],
        message: `删除未使用索引失败: ${error}`
      };
    }
  }

  /**
   * 获取慢查询建议
   */
  static async getSlowQuerySuggestions(): Promise<any[]> {
    try {
      // 查询执行时间较长的查询（需要 pg_stat_statements 扩展）
      const result = await db.execute(sql`
        SELECT
          query,
          calls,
          total_time,
          mean_time,
          max_time
        FROM pg_stat_statements
        WHERE mean_time > 1000
        ORDER BY mean_time DESC
        LIMIT 10
      `);

      return result.rows || [];
    } catch (error) {
      console.warn('[Index] pg_stat_statements 扩展未启用');
      return [];
    }
  }

  /**
   * 获取表大小统计
   */
  static async getTableStats(): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT
          schemaname AS "schemaName",
          tablename AS "tableName",
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS "totalSize",
          seq_scan AS "seqScans",
          idx_scan AS "idxScans",
          n_live_tup AS "liveTuples",
          n_dead_tup AS "deadTuples",
          last_vacuum AS "lastVacuum",
          last_autovacuum AS "lastAutovacuum"
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      return result.rows || [];
    } catch (error) {
      console.error('[Index] 获取表统计失败:', error);
      return [];
    }
  }
}

// ============================================
// 导出
// ============================================

export default IndexManager;

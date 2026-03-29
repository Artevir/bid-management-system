/**
 * 数据库重置脚本
 * 用于生产环境全新启动时清空并重建数据库
 * 
 * ⚠️ 警告：此脚本会删除所有数据，仅用于全新部署！
 * 
 * 使用方式：
 * - 生产环境: pnpm db:reset:prod (需要确认)
 * - 开发环境: pnpm db:reset
 */

import { db, pool } from './index';
import { sql } from 'drizzle-orm';
import readline from 'readline';

// 环境安全检查
function checkEnvironment(): { isProduction: boolean; allowReset: boolean } {
  const nodeEnv = process.env.NODE_ENV;
  const allowReset = process.env.ALLOW_DB_RESET === 'true';
  const isProduction = nodeEnv === 'production';
  
  return { isProduction, allowReset };
}

// 命令行确认
async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  警告：此操作将删除所有数据！');
    console.log('   请输入 "CONFIRM" 确认执行：');
    
    rl.question('> ', (answer) => {
      rl.close();
      resolve(answer === 'CONFIRM');
    });
  });
}

// 获取所有表名
async function getAllTables(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  
  return result.rows.map((row: any) => row.tablename);
}

// 删除所有表
async function dropAllTables(): Promise<void> {
  console.log('🗑️  正在删除所有表...');
  
  // 先删除外键约束
  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  
  // 删除枚举类型
  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  
  console.log('   ✓ 所有表已删除');
}

// 重建表结构（使用 Drizzle push）
async function _recreateSchema(): Promise<void> {
  console.log('🏗️  正在重建表结构...');
  console.log('   请执行: pnpm db:push');
  // 注意：实际的表创建由 drizzle-kit push 完成
}

// 显示统计
async function showStats(): Promise<void> {
  const tables = await getAllTables();
  console.log(`\n📊 当前数据库状态:`);
  console.log(`   表数量: ${tables.length}`);
  if (tables.length > 0 && tables.length <= 20) {
    console.log(`   表列表: ${tables.join(', ')}`);
  }
}

// 主函数
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('       投标管理系统 - 数据库重置工具');
  console.log('═══════════════════════════════════════════════════\n');

  const { isProduction, allowReset } = checkEnvironment();

  // 生产环境需要额外确认
  if (isProduction) {
    console.log('🚨 检测到生产环境！');
    
    if (!allowReset) {
      console.error('❌ 生产环境禁止执行重置操作！');
      console.error('   如需强制执行，请设置环境变量: ALLOW_DB_RESET=true');
      process.exit(1);
    }
    
    const confirmed = await confirmReset();
    if (!confirmed) {
      console.log('❌ 操作已取消');
      process.exit(0);
    }
  }

  try {
    // 显示当前状态
    await showStats();
    
    // 删除所有表
    await dropAllTables();
    
    // 显示重置后状态
    await showStats();
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ 数据库已重置！');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n📝 后续步骤:');
    console.log('   1. 执行 pnpm db:push 创建表结构');
    console.log('   2. 执行 pnpm db:seed 初始化基础数据（可选）');
    console.log('');

  } catch (error) {
    console.error('\n❌ 重置失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 执行
main().catch(console.error);

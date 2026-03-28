/**
 * 数据库迁移：为政采单位表添加抓取源联动字段
 * 
 * 执行方式：在项目根目录运行 node scripts/migrate-bidding-platform-sync.ts
 */

import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('开始迁移：添加抓取源联动字段...\n');
  
  try {
    // 1. 添加 crawlSourceId 字段
    console.log('1. 添加 crawl_source_id 字段...');
    await db.execute(sql`
      ALTER TABLE bidding_platforms
      ADD COLUMN IF NOT EXISTS crawl_source_id INTEGER
    `);
    console.log('   ✅ 完成\n');
    
    // 2. 添加 syncToCrawlSource 字段
    console.log('2. 添加 sync_to_crawl_source 字段...');
    await db.execute(sql`
      ALTER TABLE bidding_platforms
      ADD COLUMN IF NOT EXISTS sync_to_crawl_source BOOLEAN DEFAULT TRUE
    `);
    console.log('   ✅ 完成\n');
    
    // 3. 添加 lastSyncAt 字段
    console.log('3. 添加 last_sync_at 字段...');
    await db.execute(sql`
      ALTER TABLE bidding_platforms
      ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP
    `);
    console.log('   ✅ 完成\n');
    
    // 4. 验证字段是否添加成功
    console.log('4. 验证迁移结果...');
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bidding_platforms'
        AND column_name IN ('crawl_source_id', 'sync_to_crawl_source', 'last_sync_at')
      ORDER BY column_name
    `);
    
    console.log('   字段列表:');
    for (const row of result.rows) {
      console.log(`   - ${(row as any).column_name}: ${(row as any).data_type} (nullable: ${(row as any).is_nullable})`);
    }
    
    console.log('\n✅ 迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

migrate();

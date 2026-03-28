/**
 * 数据库配置文件
 * 使用Drizzle ORM连接PostgreSQL数据库
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// 数据库连接配置 - 优先使用URL连接字符串
const connectionString = process.env.PGDATABASE_URL || process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'bid_management',
      max: 20, // 最大连接数
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

// 创建Drizzle实例
export const db = drizzle(pool, { schema });

// 导出连接池以便关闭
export { pool };

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.PGDATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bid_management',
  },
  verbose: true,
  strict: false, // 放宽严格模式，允许自动创建
});

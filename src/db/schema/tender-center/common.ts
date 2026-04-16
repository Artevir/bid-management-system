import { boolean, jsonb, text, timestamp } from 'drizzle-orm/pg-core';

/** 中枢主表通用时间戳（对齐010 §8.4 created_at / updated_at） */
export const hubTimestamps = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};

/** 中枢主表通用软删除（工程扩展；查询侧需配合 is_deleted = false） */
export const hubSoftDelete = {
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
};

/** 备注与扩展（按需使用） */
export const hubNoteColumns = {
  note: text('note'),
  extraJson: jsonb('extra_json'),
};

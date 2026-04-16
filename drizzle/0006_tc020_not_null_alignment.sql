-- 020 对齐：确保唯一约束相关列为非空，避免 NULL 绕过唯一

-- template_variable_binding(binding_key) 非空化
UPDATE "template_variable_binding"
SET "binding_key" = ''
WHERE "binding_key" IS NULL;

ALTER TABLE "template_variable_binding"
ALTER COLUMN "binding_key" SET NOT NULL;

-- form_table_structure(table_name,row_no,col_no) 非空化
UPDATE "form_table_structure"
SET "table_name" = coalesce("table_name", '');

UPDATE "form_table_structure"
SET "row_no" = coalesce("row_no", 0);

UPDATE "form_table_structure"
SET "col_no" = coalesce("col_no", 0);

ALTER TABLE "form_table_structure"
ALTER COLUMN "table_name" SET NOT NULL;

ALTER TABLE "form_table_structure"
ALTER COLUMN "row_no" SET NOT NULL;

ALTER TABLE "form_table_structure"
ALTER COLUMN "col_no" SET NOT NULL;

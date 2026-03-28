-- ============================================
-- 性能优化索引迁移脚本
-- 用于提升高频查询的性能
-- 执行方式: psql -d your_database -f this_file.sql
-- ============================================

-- ============================================
-- 项目相关索引
-- ============================================

-- 项目表索引
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_submission_deadline ON projects(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status_deadline ON projects(status, submission_deadline) WHERE status NOT IN ('submitted', 'archived', 'lost');

-- 项目阶段索引
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_status ON project_phases(status);

-- 项目里程碑索引
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_due_date ON project_milestones(due_date);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON project_milestones(status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_reminder ON project_milestones(status, due_date, reminder_sent) WHERE status = 'pending';

-- ============================================
-- 权限相关索引（补充）
-- ============================================

-- 用户角色关联表索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- 角色权限关联表索引
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- 权限表索引（补充）
CREATE INDEX IF NOT EXISTS idx_permissions_type ON permissions(type);
CREATE INDEX IF NOT EXISTS idx_permissions_parent_id ON permissions(parentId);
CREATE INDEX IF NOT EXISTS idx_permissions_is_active ON permissions(is_active);

-- ============================================
-- 标书文档相关索引
-- ============================================

-- 投标文档表索引
CREATE INDEX IF NOT EXISTS idx_bid_documents_project_id ON bid_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_bid_documents_status ON bid_documents(status);
CREATE INDEX IF NOT EXISTS idx_bid_documents_created_at ON bid_documents(created_at DESC);

-- 标书章节表索引
CREATE INDEX IF NOT EXISTS idx_bid_chapters_document_id ON bid_chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_bid_chapters_parent_id ON bid_chapters(parent_id);
CREATE INDEX IF NOT EXISTS idx_bid_chapters_assigned_to ON bid_chapters(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bid_chapters_sort_order ON bid_chapters(document_id, sort_order);

-- ============================================
-- 知识库相关索引
-- ============================================

-- 知识条目表索引
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_status ON knowledge_entries(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_created_at ON knowledge_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_created_by ON knowledge_entries(created_by);

-- 知识分类表索引
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_parent_id ON knowledge_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_sort_order ON knowledge_categories(sort_order);

-- ============================================
-- 审核流程相关索引
-- ============================================

-- 审核流程表索引
CREATE INDEX IF NOT EXISTS idx_approval_flows_document_id ON approval_flows(document_id);
CREATE INDEX IF NOT EXISTS idx_approval_flows_assignee_id ON approval_flows(assignee_id);
CREATE INDEX IF NOT EXISTS idx_approval_flows_status ON approval_flows(status);
CREATE INDEX IF NOT EXISTS idx_approval_flows_current_level ON approval_flows(current_level);

-- 审核记录表索引
CREATE INDEX IF NOT EXISTS idx_approval_records_flow_id ON approval_records(flow_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_reviewer_id ON approval_records(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_created_at ON approval_records(created_at DESC);

-- ============================================
-- 文件相关索引
-- ============================================

-- 文件表索引
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- 文件版本表索引
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_created_at ON file_versions(created_at DESC);

-- ============================================
-- 会话与日志相关索引
-- ============================================

-- 会话表索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 审计日志表索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_code);

-- AI调用日志表索引
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_user_id ON ai_generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_type ON ai_generation_logs(type);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at ON ai_generation_logs(created_at DESC);

-- ============================================
-- 解析任务相关索引
-- ============================================

-- 解析任务表索引
CREATE INDEX IF NOT EXISTS idx_parse_tasks_project_id ON parse_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_parse_tasks_status ON parse_tasks(status);
CREATE INDEX IF NOT EXISTS idx_parse_tasks_created_at ON parse_tasks(created_at DESC);

-- 解析项表索引
CREATE INDEX IF NOT EXISTS idx_parse_items_task_id ON parse_items(task_id);
CREATE INDEX IF NOT EXISTS idx_parse_items_section_id ON parse_items(section_id);
CREATE INDEX IF NOT EXISTS idx_parse_items_status ON parse_items(status);

-- ============================================
-- 响应矩阵相关索引
-- ============================================

-- 响应矩阵表索引
CREATE INDEX IF NOT EXISTS idx_response_matrices_project_id ON response_matrices(project_id);
CREATE INDEX IF NOT EXISTS idx_response_matrices_status ON response_matrices(status);

-- 响应项表索引
CREATE INDEX IF NOT EXISTS idx_response_items_matrix_id ON response_items(matrix_id);
CREATE INDEX IF NOT EXISTS idx_response_items_section ON response_items(section);
CREATE INDEX IF NOT EXISTS idx_response_items_status ON response_items(status);

-- ============================================
-- 复合索引（针对高频查询优化）
-- ============================================

-- 项目列表查询优化
CREATE INDEX IF NOT EXISTS idx_projects_list_query ON projects(department_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner_status ON projects(owner_id, status);

-- 权限验证查询优化
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, role_id) WHERE expires_at IS NULL OR expires_at > NOW();

-- 知识搜索优化（如果使用PostgreSQL全文搜索）
-- CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_search ON knowledge_entries USING gin(to_tsvector('simple', content));

-- ============================================
-- 部分索引（减少索引大小）
-- ============================================

-- 仅索引活跃用户
CREATE INDEX IF NOT EXISTS idx_users_active ON users(department_id) WHERE status = 'active';

-- 仅索引未完成的项目
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(submission_deadline) WHERE status NOT IN ('submitted', 'archived', 'lost', 'awarded');

-- 仅索引待处理的里程碑
CREATE INDEX IF NOT EXISTS idx_milestones_pending ON project_milestones(due_date) WHERE status = 'pending';

-- ============================================
-- 索引统计查询（验证效果）
-- ============================================

-- 查看索引使用情况
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;

-- 查看未使用的索引
-- SELECT 
--   schemaname || '.' || relname AS table,
--   indexrelname AS index,
--   pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
--   idx_scan as index_scans
-- FROM pg_stat_user_indexes ui
-- JOIN pg_index i ON ui.indexrelid = i.indexrelid
-- WHERE NOT indisunique 
--   AND idx_scan < 50 
--   AND pg_relation_size(relid) > 5 * 8192
-- ORDER BY pg_relation_size(i.indexrelid) DESC;

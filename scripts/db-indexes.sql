-- ============================================
-- 数据库性能优化索引脚本
-- 用于提升查询性能
-- ============================================

-- ============================================
-- 用户相关索引
-- ============================================

-- 用户部门索引（常用查询：按部门筛选用户）
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- 用户状态索引（常用查询：筛选活跃用户）
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 用户创建时间索引（常用查询：按时间排序）
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- ============================================
-- 项目相关索引
-- ============================================

-- 项目状态索引（常用查询：按状态筛选项目）
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 项目负责人索引（常用查询：我的项目）
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- 项目部门索引（常用查询：部门项目）
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id);

-- 项目创建时间索引（常用查询：最近项目）
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- 项目截止日期索引（常用查询：即将到期项目）
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(submission_deadline);

-- 复合索引：部门+状态（常用查询：部门的活跃项目）
CREATE INDEX IF NOT EXISTS idx_projects_dept_status ON projects(department_id, status);

-- 复合索引：负责人+状态（常用查询：我的活跃项目）
CREATE INDEX IF NOT EXISTS idx_projects_owner_status ON projects(owner_id, status);

-- ============================================
-- 项目阶段索引
-- ============================================

-- 项目阶段-项目索引
CREATE INDEX IF NOT EXISTS idx_project_phases_project ON project_phases(project_id);

-- 项目阶段状态索引
CREATE INDEX IF NOT EXISTS idx_project_phases_status ON project_phases(status);

-- 项目阶段排序索引
CREATE INDEX IF NOT EXISTS idx_project_phases_sort ON project_phases(project_id, sort_order);

-- ============================================
-- 项目里程碑索引
-- ============================================

-- 里程碑-项目索引
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);

-- 里程碑状态索引
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON project_milestones(status);

-- 里程碑截止日期索引（用于预警查询）
CREATE INDEX IF NOT EXISTS idx_project_milestones_due ON project_milestones(due_date);

-- 里程碑提醒索引（用于定时任务）
CREATE INDEX IF NOT EXISTS idx_project_milestones_reminder ON project_milestones(reminder_sent, due_date);

-- ============================================
-- 文件相关索引
-- ============================================

-- 文件上传者索引
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files(uploader_id);

-- 文件状态索引
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);

-- 文件分类索引
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category_id);

-- 文件创建时间索引
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);

-- 文件哈希索引（用于去重）
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);

-- 文件MIME类型索引
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);

-- ============================================
-- 项目文件关联索引
-- ============================================

-- 项目文件-项目索引
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);

-- 项目文件-文件索引
CREATE INDEX IF NOT EXISTS idx_project_files_file ON project_files(file_id);

-- 项目文件类型索引
CREATE INDEX IF NOT EXISTS idx_project_files_type ON project_files(type);

-- 项目文件添加时间索引
CREATE INDEX IF NOT EXISTS idx_project_files_added_at ON project_files(added_at DESC);

-- ============================================
-- 项目成员索引
-- ============================================

-- 项目成员-项目索引
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

-- 项目成员-用户索引
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 项目成员角色索引
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);

-- ============================================
-- 审计日志索引
-- ============================================

-- 审计日志-用户索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- 审计日志-操作类型索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 审计日志时间索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 复合索引：用户+时间（查询某用户的操作历史）
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs(user_id, created_at DESC);

-- 复合索引：操作+时间（查询某类操作历史）
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time ON audit_logs(action, created_at DESC);

-- ============================================
-- 知识库索引
-- ============================================

-- 知识条目分类索引
CREATE INDEX IF NOT EXISTS idx_knowledge_items_category ON knowledge_items(category_id);

-- 知识条目状态索引
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON knowledge_items(status);

-- 知识条目创建者索引
CREATE INDEX IF NOT EXISTS idx_knowledge_items_creator ON knowledge_items(created_by);

-- 知识条目创建时间索引
CREATE INDEX IF NOT EXISTS idx_knowledge_items_created_at ON knowledge_items(created_at DESC);

-- 知识条目审核状态索引
CREATE INDEX IF NOT EXISTS idx_knowledge_items_review_status ON knowledge_items(review_status);

-- 知识条目标签索引（GIN索引，用于JSON数组查询）
CREATE INDEX IF NOT EXISTS idx_knowledge_items_tags ON knowledge_items USING GIN (tags);

-- ============================================
-- 模板索引
-- ============================================

-- 模板类型索引
CREATE INDEX IF NOT EXISTS idx_templates_type ON bid_templates(type);

-- 模板状态索引
CREATE INDEX IF NOT EXISTS idx_templates_status ON bid_templates(status);

-- 模板创建者索引
CREATE INDEX IF NOT EXISTS idx_templates_creator ON bid_templates(created_by);

-- 模板使用次数索引（用于热门模板排序）
CREATE INDEX IF NOT EXISTS idx_templates_usage ON bid_templates(usage_count DESC);

-- ============================================
-- 解析任务索引
-- ============================================

-- 解析任务-项目索引
CREATE INDEX IF NOT EXISTS idx_parse_tasks_project ON parse_tasks(project_id);

-- 解析任务状态索引
CREATE INDEX IF NOT EXISTS idx_parse_tasks_status ON parse_tasks(status);

-- 解析任务创建时间索引
CREATE INDEX IF NOT EXISTS idx_parse_tasks_created_at ON parse_tasks(created_at DESC);

-- ============================================
-- 解析项索引
-- ============================================

-- 解析项-任务索引
CREATE INDEX IF NOT EXISTS idx_parse_items_task ON parse_items(task_id);

-- 解析项类型索引
CREATE INDEX IF NOT EXISTS idx_parse_items_type ON parse_items(type);

-- 解析项确认状态索引
CREATE INDEX IF NOT EXISTS idx_parse_items_confirmed ON parse_items(is_confirmed);

-- 解析项低置信度索引
CREATE INDEX IF NOT EXISTS idx_parse_items_low_confidence ON parse_items(is_low_confidence);

-- ============================================
-- 审核流程索引
-- ============================================

-- 审核节点-项目索引
CREATE INDEX IF NOT EXISTS idx_approval_nodes_project ON approval_nodes(project_id);

-- 审核节点状态索引
CREATE INDEX IF NOT EXISTS idx_approval_nodes_status ON approval_nodes(status);

-- 审核节点审核人索引（我的待审核）
CREATE INDEX IF NOT EXISTS idx_approval_nodes_approver ON approval_nodes(approver_id, status);

-- 审核记录-节点索引
CREATE INDEX IF NOT EXISTS idx_approval_records_node ON approval_records(node_id);

-- 审核记录审核人索引
CREATE INDEX IF NOT EXISTS idx_approval_records_approver ON approval_records(approver_id);

-- 审核记录时间索引
CREATE INDEX IF NOT EXISTS idx_approval_records_created_at ON approval_records(created_at DESC);

-- ============================================
-- 会议纪要索引
-- ============================================

-- 会议纪要-项目索引
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_project ON meeting_minutes(project_id);

-- 会议纪要日期索引
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_date ON meeting_minutes(meeting_date DESC);

-- 会议纪要类型索引
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_type ON meeting_minutes(meeting_type);

-- ============================================
-- 客户对接记录索引
-- ============================================

-- 对接记录-项目索引
CREATE INDEX IF NOT EXISTS idx_contact_records_project ON contact_records(project_id);

-- 对接记录日期索引
CREATE INDEX IF NOT EXISTS idx_contact_records_date ON contact_records(contact_date DESC);

-- 对接记录类型索引
CREATE INDEX IF NOT EXISTS idx_contact_records_type ON contact_records(contact_type);

-- 下次对接日期索引（用于提醒）
CREATE INDEX IF NOT EXISTS idx_contact_records_next_date ON contact_records(next_contact_date);

-- ============================================
-- 项目任务索引
-- ============================================

-- 任务-项目索引
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);

-- 任务负责人索引（我的任务）
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON project_tasks(assignee_id);

-- 任务状态索引
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);

-- 任务优先级索引
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON project_tasks(priority);

-- 任务截止日期索引
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON project_tasks(due_date);

-- 父任务索引（用于子任务查询）
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks(parent_id);

-- 复合索引：负责人+状态（我的待办任务）
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_status ON project_tasks(assignee_id, status);

-- 复合索引：项目+状态（项目任务看板）
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status ON project_tasks(project_id, status);

-- ============================================
-- 分析查询性能（定期执行）
-- ============================================

-- 更新统计信息
ANALYZE;

-- 查看表大小和索引使用情况
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

-- 查看索引使用率
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 20;

-- 查看未使用的索引
SELECT
    schemaname || '.' || tablename as table,
    indexname as index,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 投标管理平台 - 数据库索引优化
-- 版本: 1.0.0
-- 说明: 为高频查询字段添加索引，提升查询性能
-- ============================================

-- ============================================
-- 1. 项目表索引优化
-- ============================================

-- 状态索引（高频查询）
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 公司索引（查询某公司的所有项目）
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);

-- 创建时间索引（按时间排序查询）
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- 复合索引：状态+公司（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_projects_status_company ON projects(status, company_id);

-- 复合索引：状态+创建时间（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_projects_status_created ON projects(status, created_at DESC);

-- 项目名称索引（模糊搜索）
CREATE INDEX IF NOT EXISTS idx_projects_name_gin ON projects USING gin(name gin_trgm_ops);

-- ============================================
-- 2. 文档表索引优化
-- ============================================

-- 项目ID索引（查询项目的所有文档）
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

-- 文档类型索引（按类型筛选）
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- 上传者索引（查询用户上传的文档）
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

-- 复合索引：项目+类型（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_documents_project_type ON documents(project_id, type);

-- 文件名索引（模糊搜索）
CREATE INDEX IF NOT EXISTS idx_documents_name_gin ON documents USING gin(name gin_trgm_ops);

-- ============================================
-- 3. 审核表索引优化
-- ============================================

-- 项目ID索引（查询项目的所有审核）
CREATE INDEX IF NOT EXISTS idx_reviews_project_id ON reviews(project_id);

-- 审核人索引（查询用户审核过的项目）
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);

-- 审核状态索引（按状态筛选）
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- 复合索引：项目+状态（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_reviews_project_status ON reviews(project_id, status);

-- 复合索引：审核人+状态（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_status ON reviews(reviewer_id, status);

-- ============================================
-- 4. 用户表索引优化
-- ============================================

-- 邮箱索引（登录查询）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 手机号索引（登录查询）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 用户名索引（模糊搜索）
CREATE INDEX IF NOT EXISTS idx_users_name_gin ON users USING gin(name gin_trgm_ops);

-- ============================================
-- 5. 公司表索引优化
-- ============================================

-- 公司名称索引（模糊搜索）
CREATE INDEX IF NOT EXISTS idx_companies_name_gin ON companies USING gin(name gin_trgm_ops);

-- 统一社会信用代码索引（唯一标识）
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_credit_code ON companies(credit_code);

-- ============================================
-- 6. 标签表索引优化
-- ============================================

-- 标签名索引（模糊搜索）
CREATE INDEX IF NOT EXISTS idx_tags_name_gin ON tags USING gin(name gin_trgm_ops);

-- ============================================
-- 7. 归档表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_archives_project_id ON archives(project_id);

-- 归档时间索引
CREATE INDEX IF NOT EXISTS idx_archives_archived_at ON archives(archived_at DESC);

-- ============================================
-- 8. 买标书记录表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_bid_doc_purchases_project_id ON bid_document_purchases(project_id);

-- 平台ID索引
CREATE INDEX IF NOT EXISTS idx_bid_doc_purchases_platform_id ON bid_document_purchases(platform_id);

-- 复合索引：项目+平台（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_bid_doc_purchases_project_platform ON bid_document_purchases(project_id, platform_id);

-- ============================================
-- 9. 打印安排表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_print_arrangements_project_id ON print_arrangements(project_id);

-- 打印状态索引
CREATE INDEX IF NOT EXISTS idx_print_arrangements_status ON print_arrangements(status);

-- 打印时间索引
CREATE INDEX IF NOT EXISTS idx_print_arrangements_printed_at ON print_arrangements(printed_at DESC);

-- ============================================
-- 10. 盖章申请表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_seal_requests_project_id ON seal_requests(project_id);

-- 申请人索引
CREATE INDEX IF NOT EXISTS idx_seal_requests_requested_by ON seal_requests(requested_by);

-- 盖章状态索引
CREATE INDEX IF NOT EXISTS idx_seal_requests_status ON seal_requests(status);

-- 复合索引：项目+状态（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_seal_requests_project_status ON seal_requests(project_id, status);

-- ============================================
-- 11. 授权委托表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_authorizations_project_id ON authorizations(project_id);

-- 被授权人索引
CREATE INDEX IF NOT EXISTS idx_authorizations_agent_id ON authorizations(agent_id);

-- 授权状态索引
CREATE INDEX IF NOT EXISTS idx_authorizations_status ON authorizations(status);

-- ============================================
-- 12. 去投标表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_bid_submissions_project_id ON bid_submissions(project_id);

-- 投标人索引
CREATE INDEX IF NOT EXISTS idx_bid_submissions_submitted_by ON bid_submissions(submitted_by);

-- 投标状态索引
CREATE INDEX IF NOT EXISTS idx_bid_submissions_status ON bid_submissions(status);

-- 投标时间索引
CREATE INDEX IF NOT EXISTS idx_bid_submissions_submitted_at ON bid_submissions(submitted_at DESC);

-- ============================================
-- 13. 中标通知书表索引优化
-- ============================================

-- 项目ID索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_notifications_project_id ON bid_notifications(project_id);

-- 领取状态索引
CREATE INDEX IF NOT EXISTS idx_bid_notifications_pickup_status ON bid_notifications(pickup_status);

-- 领取时间索引
CREATE INDEX IF NOT EXISTS idx_bid_notifications_picked_up_at ON bid_notifications(picked_up_at DESC);

-- ============================================
-- 14. 履约保证金表索引优化
-- ============================================

-- 项目ID索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_bonds_project_id ON performance_bonds(project_id);

-- 支付状态索引
CREATE INDEX IF NOT EXISTS idx_performance_bonds_payment_status ON performance_bonds(payment_status);

-- 支付时间索引
CREATE INDEX IF NOT EXISTS idx_performance_bonds_paid_at ON performance_bonds(paid_at DESC);

-- ============================================
-- 15. 书面合同表索引优化
-- ============================================

-- 项目ID索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_written_contracts_project_id ON written_contracts(project_id);

-- 签订状态索引
CREATE INDEX IF NOT EXISTS idx_written_contracts_sign_status ON written_contracts(sign_status);

-- 签订时间索引
CREATE INDEX IF NOT EXISTS idx_written_contracts_signed_at ON written_contracts(signed_at DESC);

-- ============================================
-- 16. 审计日志表索引优化
-- ============================================

-- 用户ID索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- 操作类型索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);

-- 操作时间索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 复合索引：用户+操作类型（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action_type);

-- 复合索引：操作类型+时间（常用组合查询）
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time ON audit_logs(action_type, created_at DESC);

-- ============================================
-- 17. 权限表索引优化
-- ============================================

-- 角色ID索引
CREATE INDEX IF NOT EXISTS idx_permissions_role_id ON permissions(role_id);

-- 权限代码索引（唯一标识）
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- 资源类型索引
CREATE INDEX IF NOT EXISTS idx_permissions_resource_type ON permissions(resource_type);

-- ============================================
-- 18. 租户表索引优化
-- ============================================

-- 租户名称索引（模糊搜索）
CREATE INDEX IF NOT EXISTS idx_tenants_name_gin ON tenants USING gin(name gin_trgm_ops);

-- 租户类型索引
CREATE INDEX IF NOT EXISTS idx_tenants_type ON tenants(type);

-- 状态索引
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ============================================
-- 19. 文件解读表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_bid_document_interpretations_project_id ON bid_document_interpretations(project_id);

-- 平台ID索引
CREATE INDEX IF NOT EXISTS idx_bid_document_interpretations_platform_id ON bid_document_interpretations(platform_id);

-- 创建时间索引
CREATE INDEX IF NOT EXISTS idx_bid_document_interpretations_created_at ON bid_document_interpretations(created_at DESC);

-- ============================================
-- 20. 友司支持表索引优化
-- ============================================

-- 项目ID索引
CREATE INDEX IF NOT EXISTS idx_friend_company_supports_project_id ON friend_company_supports(project_id);

-- 友司ID索引
CREATE INDEX IF NOT EXISTS idx_friend_company_supports_friend_company_id ON friend_company_supports(friend_company_id);

-- 支持状态索引
CREATE INDEX IF NOT EXISTS idx_friend_company_supports_status ON friend_company_supports(status);

-- ============================================
-- 21. 搜索优化：全文搜索索引（可选）
-- ============================================

-- 如果需要支持中文全文搜索，可以使用 zhparser 分词插件
-- CREATE INDEX IF NOT EXISTS idx_projects_name_fts ON projects USING gin(to_tsvector('simple', name));
-- CREATE INDEX IF NOT EXISTS idx_projects_description_fts ON projects USING gin(to_tsvector('simple', description));

-- ============================================
-- 22. 分区表建议（大数据量时使用）
-- ============================================

-- 对于数据量超过 1000 万的表，建议按时间分区
-- 示例：审计日志表按月分区
-- CREATE TABLE audit_logs (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   -- ... 其他字段
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- ) PARTITION BY RANGE (created_at);

-- 创建分区
-- CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================
-- 23. 索引维护建议
-- ============================================

-- 定期分析表统计信息
-- ANALYZE projects;
-- ANALYZE documents;
-- ANALYZE reviews;
-- ANALYZE audit_logs;

-- 重建索引（碎片率高时）
-- REINDEX INDEX idx_projects_status;
-- REINDEX INDEX idx_documents_project_id;

-- 清理死元组
-- VACUUM ANALYZE projects;
-- VACUUM ANALYZE documents;
-- VACUUM ANALYZE reviews;

-- ============================================
-- 24. 索引监控查询
-- ============================================

-- 查看所有索引大小
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- 查看索引使用情况
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan AS index_scans,
--   idx_tup_read AS tuples_read,
--   idx_tup_fetch AS tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- 查找未使用的索引（可以考虑删除）
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
--   AND indexrelname NOT LIKE '%_pkey'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================
-- 25. 性能优化建议
-- ============================================

-- 1. 定期更新表统计信息（每天执行）
--    ANALYZE;

-- 2. 定期清理死元组（每周执行）
--    VACUUM ANALYZE;

-- 3. 监控索引使用情况，删除未使用的索引
--    查看上面的"查找未使用的索引"查询

-- 4. 对于大表，考虑使用分区表
--    参考上面的"分区表建议"

-- 5. 对于热点数据，考虑使用缓存（Redis）
--    减少数据库查询压力

-- 6. 优化慢查询
--    开启 slow_query_log，定期分析并优化

-- ============================================
-- 执行说明
-- ============================================

-- 1. 在生产环境执行前，建议先在测试环境验证
-- 2. 执行索引创建时，会对表加锁，可能影响性能
-- 3. 建议在业务低峰期执行
-- 4. 可以使用 CONCURRENTLY 选项创建索引，避免锁表
--    示例：CREATE INDEX CONCURRENTLY idx_projects_status ON projects(status);

-- ============================================
-- 完成
-- ============================================

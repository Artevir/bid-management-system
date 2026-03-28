/**
 * 数据库同步脚本
 * 手动创建缺失的表结构
 */

import { db } from './index';
import { sql } from 'drizzle-orm';

async function syncDatabase() {
  console.log('开始同步数据库结构...');

  try {
    // 创建project_phases表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_phases (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        completed_at TIMESTAMP,
        completed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ project_phases 表已就绪');

    // 创建project_milestones表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_milestones (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        phase_id INTEGER REFERENCES project_phases(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        due_date TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        sort_order INTEGER NOT NULL DEFAULT 0,
        reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
        reminder_days INTEGER NOT NULL DEFAULT 3,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ project_milestones 表已就绪');

    // 创建project_members表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_members (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        can_view BOOLEAN NOT NULL DEFAULT TRUE,
        can_edit BOOLEAN NOT NULL DEFAULT FALSE,
        can_audit BOOLEAN NOT NULL DEFAULT FALSE,
        can_export BOOLEAN NOT NULL DEFAULT FALSE,
        max_security_level VARCHAR(20) DEFAULT 'internal',
        invited_by INTEGER REFERENCES users(id),
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, user_id)
      )
    `);
    console.log('✅ project_members 表已就绪');

    // 创建project_tags表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        color VARCHAR(7) DEFAULT '#6B7280',
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ project_tags 表已就绪');

    // 创建project_tag_relations表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_tag_relations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES project_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, tag_id)
      )
    `);
    console.log('✅ project_tag_relations 表已就绪');

    // 创建bid_documents表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bid_documents (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        progress INTEGER NOT NULL DEFAULT 0,
        current_approval_level VARCHAR(20),
        total_chapters INTEGER DEFAULT 0,
        completed_chapters INTEGER DEFAULT 0,
        word_count INTEGER DEFAULT 0,
        deadline TIMESTAMP,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ bid_documents 表已就绪');

    // 创建bid_chapters表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bid_chapters (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES bid_documents(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES bid_chapters(id) ON DELETE CASCADE,
        type VARCHAR(50),
        serial_number VARCHAR(20),
        title VARCHAR(300) NOT NULL,
        content TEXT,
        word_count INTEGER DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        is_required BOOLEAN NOT NULL DEFAULT TRUE,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        assigned_to INTEGER REFERENCES users(id),
        deadline TIMESTAMP,
        completed_at TIMESTAMP,
        response_item_id INTEGER,
        prompt_template_id INTEGER,
        prompt_parameters TEXT,
        company_id INTEGER,
        tags TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ bid_chapters 表已就绪');

    // 创建bid_archives表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bid_archives (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        project_name VARCHAR(200) NOT NULL,
        project_code VARCHAR(50) NOT NULL,
        tender_code VARCHAR(100),
        tender_organization VARCHAR(200),
        tender_agent VARCHAR(200),
        budget VARCHAR(100),
        archive_type VARCHAR(20) NOT NULL DEFAULT 'manual',
        bid_result VARCHAR(20),
        archived_by INTEGER NOT NULL REFERENCES users(id),
        archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
        document_count INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ bid_archives 表已就绪');

    // 创建bid_archive_documents表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bid_archive_documents (
        id SERIAL PRIMARY KEY,
        archive_id INTEGER NOT NULL REFERENCES bid_archives(id) ON DELETE CASCADE,
        document_id INTEGER,
        document_name VARCHAR(200) NOT NULL,
        document_version INTEGER,
        document_status VARCHAR(50),
        chapter_count INTEGER DEFAULT 0,
        word_count INTEGER DEFAULT 0,
        storage_path VARCHAR(500),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ bid_archive_documents 表已就绪');

    // 创建companies表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        short_name VARCHAR(50),
        code VARCHAR(50) NOT NULL UNIQUE,
        credit_code VARCHAR(18) NOT NULL,
        legal_person VARCHAR(50),
        registered_capital VARCHAR(100),
        established_date DATE,
        address TEXT,
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        business_scope TEXT,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ companies 表已就绪');

    // 创建competitors表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS competitors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        level VARCHAR(50),
        region VARCHAR(100),
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        strength TEXT,
        advantages TEXT,
        won_bids TEXT,
        avg_quote_deviation DECIMAL(10, 2),
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ competitors 表已就绪');

    // 创建partner_applications表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS partner_applications (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        company_name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        qualification_type VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ partner_applications 表已就绪');

    // 创建工作流定义表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workflow_definitions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        category VARCHAR(50),
        business_type VARCHAR(50),
        config TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        instance_count INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ workflow_definitions 表已就绪');

    // 创建工作流节点表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workflow_nodes (
        id SERIAL PRIMARY KEY,
        definition_id INTEGER NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
        node_key VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        config TEXT,
        assignee_type VARCHAR(20),
        assignee_value VARCHAR(500),
        multi_approve_type VARCHAR(20),
        approve_percent INTEGER,
        timeout_hours INTEGER,
        timeout_action VARCHAR(20),
        notify_config TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        position_x INTEGER,
        position_y INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ workflow_nodes 表已就绪');

    // 创建工作流转换表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workflow_transitions (
        id SERIAL PRIMARY KEY,
        definition_id INTEGER NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
        source_node_id INTEGER NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
        target_node_id INTEGER NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
        condition TEXT,
        condition_type VARCHAR(20),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ workflow_transitions 表已就绪');

    // 创建工作流实例表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id SERIAL PRIMARY KEY,
        definition_id INTEGER NOT NULL REFERENCES workflow_definitions(id),
        definition_version INTEGER NOT NULL,
        business_type VARCHAR(50) NOT NULL,
        business_id INTEGER NOT NULL,
        business_title VARCHAR(500),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        current_node_id INTEGER REFERENCES workflow_nodes(id),
        variables TEXT,
        result VARCHAR(20),
        result_comment TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ workflow_instances 表已就绪');

    // 创建工作流任务表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workflow_tasks (
        id SERIAL PRIMARY KEY,
        instance_id INTEGER NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        node_id INTEGER NOT NULL REFERENCES workflow_nodes(id),
        node_key VARCHAR(50) NOT NULL,
        node_name VARCHAR(100) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        assignee_type VARCHAR(20) NOT NULL,
        assignee_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        due_time TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        result VARCHAR(20),
        comment TEXT,
        transferred_from INTEGER REFERENCES users(id),
        transferred_at TIMESTAMP,
        transfer_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ workflow_tasks 表已就绪');

    // 创建工作流任务操作记录表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workflow_task_actions (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
        instance_id INTEGER NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL,
        comment TEXT,
        operator_id INTEGER NOT NULL REFERENCES users(id),
        before_status VARCHAR(20),
        after_status VARCHAR(20),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ workflow_task_actions 表已就绪');

    // 为已有表添加软删除字段
    try {
      // 为projects表添加软删除字段
      await db.execute(sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'is_deleted') THEN
            ALTER TABLE projects ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deleted_at') THEN
            ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deleted_by') THEN
            ALTER TABLE projects ADD COLUMN deleted_by INTEGER REFERENCES users(id);
          END IF;
        END $$;
      `);
      console.log('✅ projects 表软删除字段已就绪');

      // 为bid_documents表添加软删除字段
      await db.execute(sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bid_documents' AND column_name = 'is_deleted') THEN
            ALTER TABLE bid_documents ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bid_documents' AND column_name = 'deleted_at') THEN
            ALTER TABLE bid_documents ADD COLUMN deleted_at TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bid_documents' AND column_name = 'deleted_by') THEN
            ALTER TABLE bid_documents ADD COLUMN deleted_by INTEGER REFERENCES users(id);
          END IF;
        END $$;
      `);
      console.log('✅ bid_documents 表软删除字段已就绪');
    } catch (error) {
      console.log('⚠️ 软删除字段添加警告:', error);
    }

    // 创建LLM配置管理相关表
    console.log('\n开始创建LLM配置管理表...');

    // 创建枚举类型
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE llm_provider AS ENUM ('doubao', 'deepseek', 'qwen', 'openai', 'kimi', 'glm', 'custom');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE config_status AS ENUM ('active', 'inactive', 'error');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 创建llm_configs表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS llm_configs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE,
        description TEXT,
        provider llm_provider NOT NULL,
        model_id VARCHAR(100) NOT NULL,
        api_key VARCHAR(500),
        api_endpoint VARCHAR(500),
        api_version VARCHAR(50),
        default_temperature VARCHAR(10) DEFAULT '0.7',
        max_tokens INTEGER DEFAULT 4096,
        default_thinking BOOLEAN DEFAULT FALSE,
        default_caching BOOLEAN DEFAULT FALSE,
        extra_config JSONB DEFAULT '{}',
        status config_status NOT NULL DEFAULT 'active',
        is_default BOOLEAN DEFAULT FALSE,
        last_used_at TIMESTAMP,
        scope VARCHAR(20) DEFAULT 'company',
        department_id INTEGER,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ llm_configs 表已就绪');

    // 创建llm_conversations表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS llm_conversations (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200),
        config_id INTEGER REFERENCES llm_configs(id),
        system_prompt TEXT,
        temperature VARCHAR(10) DEFAULT '0.7',
        thinking BOOLEAN DEFAULT FALSE,
        caching BOOLEAN DEFAULT FALSE,
        message_count INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost VARCHAR(20) DEFAULT '0',
        status VARCHAR(20) DEFAULT 'active',
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ llm_conversations 表已就绪');

    // 创建llm_messages表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS llm_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES llm_conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        content_type VARCHAR(20) DEFAULT 'text',
        media_urls JSONB DEFAULT '[]',
        tokens INTEGER,
        latency INTEGER,
        response_id VARCHAR(100),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ llm_messages 表已就绪');

    // 创建llm_call_logs表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS llm_call_logs (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES llm_configs(id),
        conversation_id INTEGER REFERENCES llm_conversations(id),
        message_id INTEGER REFERENCES llm_messages(id),
        model_id VARCHAR(100) NOT NULL,
        provider llm_provider NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        latency INTEGER,
        first_token_latency INTEGER,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        call_context JSONB DEFAULT '{}',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ llm_call_logs 表已就绪');

    // 创建llm_prompt_templates表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS llm_prompt_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE,
        description TEXT,
        system_prompt TEXT,
        user_prompt_template TEXT,
        variables JSONB DEFAULT '[]',
        recommended_model VARCHAR(100),
        recommended_temperature VARCHAR(10),
        category VARCHAR(50),
        tags JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'active',
        is_public BOOLEAN DEFAULT TRUE,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ llm_prompt_templates 表已就绪');

    console.log('\n🎉 数据库结构同步完成！');
    
  } catch (error) {
    console.error('❌ 同步失败:', error);
    throw error;
  }
}

// 执行同步
syncDatabase()
  .then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 执行失败:', error);
    process.exit(1);
  });

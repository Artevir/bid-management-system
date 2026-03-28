# 数据库模型设计文档

> 任务编号：SEC-001
> 任务名称：设计用户、角色、权限、部门、项目成员数据模型
> 完成日期：2026-03-16

---

## 📊 设计概览

本数据模型采用**RBAC（Role-Based Access Control，基于角色的访问控制）**架构，支持：
- ✅ 多租户隔离（部门级、项目级）
- ✅ 细粒度权限控制（菜单级、API级）
- ✅ 项目级成员授权
- ✅ 文档密级管控
- ✅ 全流程审计日志
- ✅ 会话安全管理

---

## 🗂️ 核心实体关系图

```
┌─────────────┐
│  Department │◄───────┐
└──────┬──────┘        │
       │               │
       │               │
       ▼               │
┌─────────────┐        │
│    User     │        │
└──────┬──────┘        │
       │               │
       │               │
       ├────────────────┤
       │                │
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│  UserRole   │  │   Project   │
└──────┬──────┘  └──────┬──────┘
       │                │
       │                │
       ▼                ▼
┌─────────────┐  ┌──────────────┐
│    Role     │  │ProjectMember │
└──────┬──────┘  └──────────────┘
       │
       │
       ▼
┌─────────────┐
│RolePermission│
└──────┬──────┘
       │
       │
       ▼
┌─────────────┐
│ Permission  │
└─────────────┘
```

---

## 📋 表结构设计

### 1. 部门表（departments）

**用途**：组织架构管理，支持多层级部门结构

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| name | VARCHAR(100) | 部门名称 | NOT NULL |
| code | VARCHAR(50) | 部门编码 | NOT NULL, UNIQUE |
| parent_id | INTEGER | 父部门ID | FOREIGN KEY |
| description | TEXT | 部门描述 | - |
| level | INTEGER | 部门层级 | NOT NULL, DEFAULT 1 |
| sort_order | INTEGER | 排序号 | NOT NULL, DEFAULT 0 |
| is_active | BOOLEAN | 是否启用 | NOT NULL, DEFAULT true |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | NOT NULL, DEFAULT NOW() |

**索引**：
- `departments_code_key`：部门编码唯一索引

**关系**：
- 自引用关系：parent_id → departments.id（支持多层级部门）
- 一对多关系：一个部门可以有多个用户

---

### 2. 用户表（users）

**用途**：用户基本信息管理

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| username | VARCHAR(50) | 用户名 | NOT NULL, UNIQUE |
| email | VARCHAR(100) | 邮箱 | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | 密码哈希 | NOT NULL |
| real_name | VARCHAR(50) | 真实姓名 | NOT NULL |
| phone | VARCHAR(20) | 手机号 | - |
| avatar | VARCHAR(255) | 头像URL | - |
| department_id | INTEGER | 部门ID | NOT NULL, FOREIGN KEY |
| position | VARCHAR(50) | 职位 | - |
| status | ENUM | 用户状态 | NOT NULL, DEFAULT 'active' |
| last_login_at | TIMESTAMP | 最后登录时间 | - |
| last_login_ip | VARCHAR(50) | 最后登录IP | - |
| failed_login_attempts | INTEGER | 失败登录次数 | NOT NULL, DEFAULT 0 |
| locked_until | TIMESTAMP | 锁定截止时间 | - |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | NOT NULL, DEFAULT NOW() |

**用户状态枚举**：
- `active`：正常
- `inactive`：未激活
- `locked`：已锁定

**索引**：
- `users_username_key`：用户名唯一索引
- `users_email_key`：邮箱唯一索引

**关系**：
- 多对一关系：多个用户属于一个部门
- 一对多关系：一个用户可以有多个角色、多个会话、参与多个项目

---

### 3. 角色表（roles）

**用途**：角色定义，支持角色层级

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| name | VARCHAR(50) | 角色名称 | NOT NULL, UNIQUE |
| code | VARCHAR(50) | 角色代码 | NOT NULL, UNIQUE |
| description | TEXT | 角色描述 | - |
| is_system | BOOLEAN | 是否系统角色 | NOT NULL, DEFAULT false |
| level | INTEGER | 角色级别 | NOT NULL, DEFAULT 1 |
| is_active | BOOLEAN | 是否启用 | NOT NULL, DEFAULT true |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | NOT NULL, DEFAULT NOW() |

**索引**：
- `roles_name_key`：角色名称唯一索引
- `roles_code_key`：角色代码唯一索引

**预置角色**：
- `super_admin`：超级管理员
- `admin`：系统管理员
- `department_manager`：部门经理
- `project_manager`：项目经理
- `bidder`：标书编制人员
- `auditor`：审核人员
- `viewer`：查看人员

---

### 4. 权限表（permissions）

**用途**：权限定义，支持菜单权限和API权限

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| name | VARCHAR(100) | 权限名称 | NOT NULL |
| code | VARCHAR(100) | 权限代码 | NOT NULL, UNIQUE |
| resource | VARCHAR(50) | 资源名称 | NOT NULL |
| action | VARCHAR(20) | 操作类型 | NOT NULL |
| description | TEXT | 权限描述 | - |
| parent_id | INTEGER | 父权限ID | FOREIGN KEY |
| type | VARCHAR(20) | 权限类型 | NOT NULL, DEFAULT 'menu' |
| path | VARCHAR(255) | 路径（菜单或API） | - |
| method | VARCHAR(10) | HTTP方法 | - |
| icon | VARCHAR(50) | 菜单图标 | - |
| sort_order | INTEGER | 排序号 | NOT NULL, DEFAULT 0 |
| is_active | BOOLEAN | 是否启用 | NOT NULL, DEFAULT true |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | NOT NULL, DEFAULT NOW() |

**权限类型**：
- `menu`：菜单权限
- `api`：API权限

**操作类型**：
- `create`：创建
- `read`：查看
- `update`：更新
- `delete`：删除
- `export`：导出
- `audit`：审核

**索引**：
- `permissions_code_key`：权限代码唯一索引
- `permissions_resource_action_key`：资源+操作联合唯一索引

---

### 5. 用户角色关联表（user_roles）

**用途**：用户与角色的多对多关系

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| user_id | INTEGER | 用户ID | NOT NULL, FOREIGN KEY |
| role_id | INTEGER | 角色ID | NOT NULL, FOREIGN KEY |
| assigned_by | INTEGER | 分配人ID | FOREIGN KEY |
| assigned_at | TIMESTAMP | 分配时间 | NOT NULL, DEFAULT NOW() |
| expires_at | TIMESTAMP | 过期时间 | - |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |

**索引**：
- `user_roles_user_role_key`：用户+角色联合唯一索引

**关系**：
- 多对一关系：多个用户角色关联记录对应一个用户
- 多对一关系：多个用户角色关联记录对应一个角色

---

### 6. 角色权限关联表（role_permissions）

**用途**：角色与权限的多对多关系

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| role_id | INTEGER | 角色ID | NOT NULL, FOREIGN KEY |
| permission_id | INTEGER | 权限ID | NOT NULL, FOREIGN KEY |
| granted_by | INTEGER | 授权人ID | FOREIGN KEY |
| granted_at | TIMESTAMP | 授权时间 | NOT NULL, DEFAULT NOW() |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |

**索引**：
- `role_permissions_role_permission_key`：角色+权限联合唯一索引

---

### 7. 项目表（projects）

**用途**：投标项目管理

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| name | VARCHAR(200) | 项目名称 | NOT NULL |
| code | VARCHAR(50) | 项目编号 | NOT NULL, UNIQUE |
| type | VARCHAR(50) | 项目类型 | - |
| industry | VARCHAR(50) | 行业 | - |
| region | VARCHAR(50) | 区域 | - |
| status | VARCHAR(20) | 项目状态 | NOT NULL, DEFAULT 'draft' |
| owner_id | INTEGER | 项目负责人ID | NOT NULL, FOREIGN KEY |
| department_id | INTEGER | 所属部门ID | NOT NULL, FOREIGN KEY |
| description | TEXT | 项目描述 | - |
| start_date | TIMESTAMP | 开始日期 | - |
| end_date | TIMESTAMP | 结束日期 | - |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | NOT NULL, DEFAULT NOW() |

**项目状态**：
- `draft`：草稿
- `in_progress`：进行中
- `submitted`：已提交
- `won`：中标
- `lost`：未中标
- `cancelled`：已取消

---

### 8. 项目成员表（project_members）

**用途**：项目成员管理，支持细粒度权限控制

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| project_id | INTEGER | 项目ID | NOT NULL, FOREIGN KEY |
| user_id | INTEGER | 用户ID | NOT NULL, FOREIGN KEY |
| role | VARCHAR(20) | 成员角色 | NOT NULL |
| can_view | BOOLEAN | 可查看权限 | NOT NULL, DEFAULT true |
| can_edit | BOOLEAN | 可编辑权限 | NOT NULL, DEFAULT false |
| can_audit | BOOLEAN | 可审核权限 | NOT NULL, DEFAULT false |
| can_export | BOOLEAN | 可导出权限 | NOT NULL, DEFAULT false |
| max_security_level | ENUM | 最高可访问密级 | DEFAULT 'internal' |
| joined_at | TIMESTAMP | 加入时间 | NOT NULL, DEFAULT NOW() |
| invited_by | INTEGER | 邀请人ID | FOREIGN KEY |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |

**成员角色**：
- `owner`：项目负责人
- `editor`：编辑人员
- `viewer`：查看人员
- `auditor`：审核人员

**文档密级**：
- `public`：公开
- `internal`：内部
- `confidential`：机密
- `secret`：绝密

**索引**：
- `project_members_project_user_key`：项目+用户联合唯一索引

---

### 9. 审计日志表（audit_logs）

**用途**：操作审计日志，全流程可追溯

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| user_id | INTEGER | 用户ID | FOREIGN KEY |
| username | VARCHAR(50) | 用户名（冗余） | - |
| action | VARCHAR(50) | 操作类型 | NOT NULL |
| resource | VARCHAR(50) | 资源类型 | NOT NULL |
| resource_id | INTEGER | 资源ID | - |
| resource_code | VARCHAR(100) | 资源编号 | - |
| description | TEXT | 操作描述 | - |
| ip_address | VARCHAR(50) | IP地址 | - |
| user_agent | TEXT | 用户代理 | - |
| request_method | VARCHAR(10) | 请求方法 | - |
| request_path | VARCHAR(255) | 请求路径 | - |
| request_params | TEXT | 请求参数（JSON） | - |
| response_status | INTEGER | 响应状态码 | - |
| error_message | TEXT | 错误信息 | - |
| duration | INTEGER | 执行时长（毫秒） | - |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |

**操作类型**：
- `login`：登录
- `logout`：登出
- `create`：创建
- `update`：更新
- `delete`：删除
- `view`：查看
- `export`：导出
- `download`：下载
- `audit`：审核

---

### 10. 会话表（sessions）

**用途**：JWT刷新令牌管理，支持多设备登录

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | SERIAL | 主键 | PRIMARY KEY |
| user_id | INTEGER | 用户ID | NOT NULL, FOREIGN KEY |
| token_hash | VARCHAR(255) | 令牌哈希 | NOT NULL, UNIQUE |
| ip_address | VARCHAR(50) | IP地址 | - |
| user_agent | TEXT | 用户代理 | - |
| device_info | VARCHAR(255) | 设备信息 | - |
| expires_at | TIMESTAMP | 过期时间 | NOT NULL |
| last_accessed_at | TIMESTAMP | 最后访问时间 | NOT NULL, DEFAULT NOW() |
| created_at | TIMESTAMP | 创建时间 | NOT NULL, DEFAULT NOW() |

**索引**：
- `sessions_token_hash_key`：令牌哈希唯一索引
- `sessions_user_id_idx`：用户ID索引

---

## 🔐 权限控制设计

### RBAC权限模型

```
用户 → 角色 → 权限
 │      │      │
 │      │      └─ 资源+操作（如：user:create, project:read）
 │      │
 │      └─ 角色定义（如：管理员、项目经理）
 │
 └─ 用户归属（如：张三属于"管理员"角色）
```

### 权限粒度

1. **菜单权限**：控制前端菜单的显示与隐藏
   - 存储路径：`permissions.path`（如：`/dashboard/projects`）
   - 类型标识：`permissions.type = 'menu'`

2. **API权限**：控制后端接口的访问权限
   - 存储路径：`permissions.path`（如：`/api/projects`）
   - 类型标识：`permissions.type = 'api'`
   - HTTP方法：`permissions.method`（GET/POST/PUT/DELETE）

### 项目级权限控制

```
项目成员权限矩阵：
┌─────────┬──────┬──────┬──────┬──────┐
│  角色   │ 查看 │ 编辑 │ 审核 │ 导出 │
├─────────┼──────┼──────┼──────┼──────┤
│  owner  │  ✓   │  ✓   │  ✓   │  ✓   │
│ editor  │  ✓   │  ✓   │  ✗   │  ✓   │
│ viewer  │  ✓   │  ✗   │  ✗   │  ✗   │
│ auditor │  ✓   │  ✗   │  ✓   │  ✓   │
└─────────┴──────┴──────┴──────┴──────┘
```

### 文档密级控制

```
文档密级访问规则：
┌─────────────┬──────────────────────┐
│   用户密级   │     可访问文档密级    │
├─────────────┼──────────────────────┤
│   public    │ public               │
│   internal  │ public, internal     │
│ confidential│ public, internal,    │
│             │ confidential         │
│   secret    │ public, internal,    │
│             │ confidential, secret │
└─────────────┴──────────────────────┘
```

---

## 🚀 使用指南

### 1. 数据库初始化

```bash
# 创建数据库
createdb bid_management

# 或使用psql
psql -U postgres -c "CREATE DATABASE bid_management;"

# 生成迁移文件
pnpm db:generate

# 执行迁移
pnpm db:migrate
```

### 2. 环境变量配置

复制 `.env.example` 为 `.env`，并修改配置：

```bash
cp .env.example .env
```

修改数据库连接信息：
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=bid_management
```

### 3. 初始化数据

```bash
# 运行初始化脚本（待创建）
pnpm db:seed
```

---

## 📊 数据模型图

完整的ER图请参考：`docs/database-er-diagram.png`（待生成）

---

## ✅ 验收标准

- [x] 完成用户、角色、部门、项目成员、权限关系建模
- [x] 支持多层级部门结构
- [x] 支持RBAC权限控制
- [x] 支持项目级成员授权
- [x] 支持文档密级管控
- [x] 支持审计日志记录
- [x] 支持会话管理
- [x] 通过Drizzle ORM Schema评审

---

## 📝 下一步

1. **SEC-002**：实现登录鉴权（JWT/Session）
2. **SEC-003**：实现菜单/接口级权限控制
3. **SEC-004**：实现项目级成员授权
4. **SEC-005**：实现文档密级与访问校验

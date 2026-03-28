# 环境配置与部署指南

本文档说明如何区分测试环境和生产环境，确保测试环境可以使用测试数据，生产环境可以全新启动。

---

## 📁 环境变量配置

### 1. 环境变量文件结构

```
项目根目录/
├── .env.example          # 环境变量模板（提交到Git）
├── .env.local            # 本地开发环境（不提交）
├── .env.test             # 测试环境配置（可选提交）
└── .env.production       # 生产环境配置（不提交，通过CI/CD注入）
```

### 2. 关键环境变量

```bash
# 环境标识
NODE_ENV=development|test|production

# 数据库连接
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# 安全开关（防止误操作生产环境）
ALLOW_SEED_DATA=false    # 是否允许执行种子数据
ALLOW_DB_RESET=false     # 是否允许重置数据库

# JWT配置
JWT_SECRET=your-secret-key
```

---

## 🗄️ 数据库操作命令

### 开发/测试环境

```bash
# 1. 创建表结构
pnpm db:push

# 2. 初始化种子数据（测试数据）
pnpm db:seed

# 3. 一键初始化（表结构 + 种子数据）
pnpm db:init
```

### 生产环境

```bash
# 仅创建表结构（空数据库）
pnpm db:init:prod

# 或者分步执行
pnpm db:push
```

---

## 🚀 部署流程

### 测试环境部署

```bash
# 1. 设置环境变量
export NODE_ENV=test
export DATABASE_URL=postgresql://...
export ALLOW_SEED_DATA=true

# 2. 安装依赖
pnpm install

# 3. 初始化数据库（含测试数据）
pnpm db:init

# 4. 构建应用
pnpm build

# 5. 启动服务
pnpm start
```

### 生产环境部署（全新启动）

```bash
# 1. 设置环境变量
export NODE_ENV=production
export DATABASE_URL=postgresql://...
export JWT_SECRET=<strong-random-key>
export ALLOW_SEED_DATA=false
export ALLOW_DB_RESET=false

# 2. 安装依赖
pnpm install --prod

# 3. 仅创建表结构（不初始化数据）
pnpm db:init:prod

# 4. 构建应用
pnpm build

# 5. 启动服务
pnpm start
```

---

## 🔒 安全机制

### 环境检测

种子数据脚本会在执行前检查环境：

```typescript
// src/db/seed.ts
function checkEnvironment() {
  if (nodeEnv === 'production' && !allowSeed) {
    console.error('❌ 禁止在生产环境执行种子数据脚本！');
    process.exit(1);
  }
}
```

### 数据库重置保护

重置脚本需要额外确认：

```bash
# 生产环境需要设置 ALLOW_DB_RESET=true
# 并在命令行输入 "CONFIRM" 确认
pnpm db:reset
```

---

## 📊 环境对比

| 操作 | 开发环境 | 测试环境 | 生产环境 |
|------|---------|---------|---------|
| 创建表结构 | ✅ `pnpm db:push` | ✅ `pnpm db:push` | ✅ `pnpm db:push` |
| 种子数据 | ✅ `pnpm db:seed` | ✅ `pnpm db:seed` | ❌ 默认禁止 |
| 重置数据库 | ✅ `pnpm db:reset` | ⚠️ 需确认 | ❌ 默认禁止 |
| 默认管理员 | 自动创建 | 自动创建 | 需手动创建 |

---

## 🆕 生产环境初始化清单

生产环境全新启动时，需要手动完成以下步骤：

### 1. 创建管理员账号

```sql
-- 通过数据库直接插入（密码需要bcrypt加密）
INSERT INTO users (username, email, password_hash, real_name, department_id, status)
VALUES ('admin', 'admin@company.com', '<hashed-password>', '管理员', 1, 'active');
```

或通过 API 接口创建（如果有注册接口）。

### 2. 创建基础部门

```sql
INSERT INTO departments (name, code, level, sort_order)
VALUES ('总公司', 'HQ', 1, 0);
```

### 3. 配置公司信息

在系统界面中添加公司基本信息。

---

## 🔧 CI/CD 配置示例

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Initialize Database (Production)
        env:
          NODE_ENV: production
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
        run: pnpm db:init:prod
      
      - name: Build
        run: pnpm build
      
      - name: Deploy
        run: pnpm start
```

---

## ⚠️ 注意事项

1. **永远不要**将 `.env.local` 或 `.env.production` 提交到 Git
2. **永远不要**在生产环境设置 `ALLOW_SEED_DATA=true`
3. 生产环境的 `JWT_SECRET` 必须是强随机字符串
4. 定期备份生产数据库
5. 首次部署后立即修改默认管理员密码

---

## 📞 常见问题

### Q: 如何在不运行种子数据的情况下创建管理员？

A: 可以通过数据库直接插入，或创建一个专门的"创建首个管理员"接口。

### Q: 测试数据和正式数据会混淆吗？

A: 不会。测试环境和生产环境使用完全不同的数据库实例（通过不同的 `DATABASE_URL` 区分）。

### Q: 如何验证当前是什么环境？

A: 查看系统设置页面或日志输出，会显示 `NODE_ENV` 的值。

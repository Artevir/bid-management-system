# E2E端到端测试指南

## 目录

1. [概述](#概述)
2. [环境配置](#环境配置)
3. [运行测试](#运行测试)
4. [项目结构](#项目结构)
5. [Page Object Model](#page-object-model)
6. [编写测试用例](#编写测试用例)
7. [测试Fixtures](#测试fixtures)
8. [测试数据工厂](#测试数据工厂)
9. [最佳实践](#最佳实践)
10. [常见问题](#常见问题)

---

## 概述

本项目采用 [Playwright](https://playwright.dev/) 作为E2E测试框架，具有以下特点：

- **跨浏览器支持**: Chromium、Firefox、WebKit
- **移动端测试**: 支持iOS和Android设备模拟
- **自动等待**: 智能等待元素可操作状态
- **内置断言**: 丰富的断言库，支持自动重试
- **调试工具**: Trace Viewer、Codegen、UI Mode
- **并行执行**: 支持测试并行运行，提高效率

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Playwright | 1.58.2 | E2E测试框架 |
| @faker-js/faker | 9.9.0 | 测试数据生成 |
| TypeScript | 5.x | 测试代码编写 |

### 测试覆盖模块

| 模块 | 测试文件 | 用例数 | 覆盖范围 |
|------|----------|--------|----------|
| 认证 | auth.spec.ts | 20 | 登录/登出、表单验证、安全特性 |
| 项目管理 | projects.spec.ts | 17 | 项目CRUD、搜索筛选、分页 |
| 知识库 | knowledge.spec.ts | 13 | 条目管理、搜索、审批流程 |
| 工作台 | dashboard.spec.ts | 12 | 统计卡片、快捷入口、待办事项 |
| 驾驶舱 | dashboard-cockpit.spec.ts | 12 | 核心指标、图表交互、实时更新 |
| AI治理 | ai-governance.spec.ts | 7 | 质量指标、模型监控 |
| 审核管理 | approval.spec.ts | 7 | 审批流程、批量操作 |

---

## 环境配置

### 安装依赖

```bash
# 安装项目依赖
pnpm install

# 安装Playwright浏览器（首次运行）
npx playwright install

# 安装特定浏览器
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

### 配置文件

测试配置位于 `playwright.config.ts`，主要配置项：

```typescript
export default defineConfig({
  // 测试目录
  testDir: './e2e',
  
  // 测试文件匹配模式
  testMatch: '**/*.spec.ts',
  
  // 全局超时时间（毫秒）
  timeout: 30000,
  
  // 基础URL
  use: {
    baseURL: 'http://localhost:5000',
  },
  
  // 浏览器项目配置
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],
});
```

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `BASE_URL` | 测试目标URL | `http://localhost:5000` |
| `CI` | CI环境标识 | - |

---

## 运行测试

### 基本命令

```bash
# 运行所有测试
pnpm test:e2e

# 运行特定浏览器测试
pnpm test:e2e --project=chromium

# 运行特定测试文件
pnpm test:e2e e2e/tests/auth.spec.ts

# 运行特定测试用例（通过标题匹配）
pnpm test:e2e -g "登录功能"

# UI模式运行（推荐调试时使用）
pnpm test:e2e:ui

# 查看测试报告
pnpm test:e2e:report
```

### CI环境运行

在CI环境中，配置会自动调整：

- 禁止 `test.only`
- 失败测试自动重试2次
- 限制为单线程执行

```bash
# CI环境运行命令
CI=true pnpm test:e2e
```

### 调试模式

```bash
# 使用UI模式调试
pnpm test:e2e:ui

# 查看Trace
npx playwright show-trace trace.zip

# 生成测试代码（录制）
npx playwright codegen http://localhost:5000
```

---

## 项目结构

```
e2e/
├── fixtures.ts              # 自定义测试Fixtures
├── factories.ts             # 测试数据工厂
├── helpers.ts               # 测试辅助函数
├── index.ts                 # 统一导出入口
├── pages/                   # Page Object Model
│   ├── index.ts             # 页面对象导出
│   ├── login.page.ts        # 登录页
│   ├── dashboard.page.ts    # 工作台页
│   ├── projects.page.ts     # 项目列表页
│   ├── project-detail.page.ts # 项目详情页
│   └── knowledge.page.ts    # 知识库页
└── tests/                   # 测试用例
    ├── auth.spec.ts         # 认证模块测试
    ├── projects.spec.ts     # 项目管理测试
    ├── knowledge.spec.ts    # 知识库管理测试
    ├── dashboard.spec.ts    # 工作台测试
    ├── dashboard-cockpit.spec.ts # 驾驶舱测试
    ├── ai-governance.spec.ts # AI治理中心测试
    └── approval.spec.ts     # 审核管理测试
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `playwright.config.ts` | 全局测试配置 |
| `e2e/fixtures.ts` | 自定义测试Fixtures，处理认证等共享状态 |
| `e2e/factories.ts` | 测试数据生成工厂，使用Faker生成随机数据 |
| `e2e/helpers.ts` | 通用辅助函数，如等待、断言等 |
| `e2e/pages/*.page.ts` | 页面对象模型，封装页面元素和操作 |
| `e2e/tests/*.spec.ts` | 测试用例文件 |

---

## Page Object Model

Page Object Model (POM) 是一种设计模式，将页面元素和操作封装到独立的类中，提高代码可维护性和复用性。

### 基本结构

```typescript
// e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectErrorMessage(message: string) {
    await expect(this.errorMessage).toHaveText(message);
  }
}
```

### 使用页面对象

```typescript
// e2e/tests/auth.spec.ts
import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/login.page';

test('用户登录成功', async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await loginPage.goto();
  await loginPage.login('testuser', 'password123');
  
  await expect(page).toHaveURL('/dashboard');
});
```

### 最佳实践

1. **单一职责**: 每个Page类只负责一个页面
2. **元素封装**: 将选择器封装为Locator属性
3. **操作封装**: 将复杂操作封装为方法
4. **不包含断言**: Page类不应包含测试断言，断言在测试用例中编写

---

## 编写测试用例

### 基本结构

```typescript
import { test, expect } from '../fixtures';

test.describe('模块名称', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前的准备工作
  });

  test('测试用例描述', async ({ page, loginPage }) => {
    // 测试步骤
  });
});
```

### 测试组织结构

```typescript
test.describe('功能模块', () => {
  test.describe('子功能', () => {
    test('测试用例1', async ({ page }) => {
      // ...
    });
    
    test('测试用例2', async ({ page }) => {
      // ...
    });
  });
});
```

### 常用断言

```typescript
// 元素可见性
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();

// 文本内容
await expect(locator).toHaveText('预期文本');
await expect(locator).toContainText('部分文本');

// 表单值
await expect(locator).toHaveValue('预期值');
await expect(locator).toBeEmpty();

// 状态
await expect(locator).toBeEnabled();
await expect(locator).toBeDisabled();
await expect(locator).toBeChecked();

// 数量
await expect(locator).toHaveCount(3);

// URL
await expect(page).toHaveURL('/expected-path');

// 页面标题
await expect(page).toHaveTitle('预期标题');
```

### 常用操作

```typescript
// 导航
await page.goto('/path');

// 点击
await locator.click();
await locator.dblclick();

// 表单输入
await locator.fill('输入内容');
await locator.clear();
await locator.check(); // 复选框
await locator.selectOption('option1'); // 下拉选择

// 键盘操作
await locator.press('Enter');
await page.keyboard.press('Control+A');

// 等待
await locator.waitFor({ state: 'visible' });
await page.waitForURL('/expected-url');
await page.waitForLoadState('networkidle');

// 截图
await page.screenshot({ path: 'screenshot.png' });
```

---

## 测试Fixtures

Fixtures 用于在测试之间共享通用设置，如认证状态、页面对象等。

### 自定义Fixtures

```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { DashboardPage } from './pages/dashboard.page';

// 扩展测试对象
export const test = base.extend<{
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  authenticatedPage: Page;
}>({
  // 自动创建页面对象
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  
  // 认证后的页面
  authenticatedPage: async ({ page }, use) => {
    // 执行登录
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('testuser', 'password');
    
    // 传递已认证的页面
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### 使用Fixtures

```typescript
// 需要认证的测试
test('查看项目列表', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/projects');
  await expect(authenticatedPage.locator('.project-list')).toBeVisible();
});

// 不需要认证的测试
test('登录页面显示', async ({ loginPage }) => {
  await loginPage.goto();
  await expect(loginPage.loginButton).toBeVisible();
});
```

---

## 测试数据工厂

使用工厂模式生成测试数据，保证数据随机性和一致性。

### 工厂定义

```typescript
// e2e/factories.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const TestDataFactory = {
  // 用户数据
  user: (overrides = {}) => ({
    username: faker.internet.username(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
    name: faker.person.fullName(),
    ...overrides,
  }),

  // 项目数据
  project: (overrides = {}) => ({
    name: faker.company.name() + '项目',
    code: `PRJ-${faker.string.numeric(4)}`,
    description: faker.lorem.paragraph(),
    startDate: faker.date.future().toISOString(),
    endDate: faker.date.future({ years: 1 }).toISOString(),
    status: faker.helpers.arrayElement(['draft', 'active', 'completed']),
    ...overrides,
  }),

  // 知识条目数据
  knowledge: (overrides = {}) => ({
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    category: faker.helpers.arrayElement(['技术', '商务', '法律', '其他']),
    tags: faker.helpers.arrayElements(['标签1', '标签2', '标签3'], 2),
    ...overrides,
  }),
};
```

### 使用工厂

```typescript
test('创建新项目', async ({ page }) => {
  const projectData = TestDataFactory.project({ 
    name: '测试项目-' + Date.now() 
  });
  
  await page.fill('[name="name"]', projectData.name);
  await page.fill('[name="code"]', projectData.code);
  await page.fill('[name="description"]', projectData.description);
  // ...
});
```

---

## 最佳实践

### 1. 使用语义化选择器

```typescript
// 推荐：使用语义化属性
await page.locator('[data-testid="submit-button"]').click();
await page.getByRole('button', { name: '提交' }).click();
await page.getByLabel('用户名').fill('test');

// 避免：使用脆弱的选择器
await page.locator('#root > div > div:nth-child(3) > button').click();
```

### 2. 添加data-testid属性

```tsx
// 组件中添加测试ID
<Button data-testid="submit-button">提交</Button>
<Input data-testid="username-input" label="用户名" />
```

### 3. 合理组织测试

```typescript
test.describe('项目管理', () => {
  test.describe('项目列表', () => {
    test('显示项目列表', async () => {});
    test('搜索项目', async () => {});
  });
  
  test.describe('项目创建', () => {
    test('创建成功', async () => {});
    test('表单验证', async () => {});
  });
});
```

### 4. 使用测试钩子

```typescript
test.describe('项目操作', () => {
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    // 创建测试数据
    const response = await request.post('/api/projects', {
      data: TestDataFactory.project(),
    });
    projectId = (await response.json()).id;
  });

  test.afterAll(async ({ request }) => {
    // 清理测试数据
    await request.delete(`/api/projects/${projectId}`);
  });
});
```

### 5. 处理异步操作

```typescript
// 等待API响应
const responsePromise = page.waitForResponse('/api/projects');
await button.click();
const response = await responsePromise;

// 等待请求完成
await page.waitForRequest('/api/projects');

// 等待网络空闲
await page.waitForLoadState('networkidle');
```

### 6. 模拟API响应

```typescript
test('模拟错误响应', async ({ page }) => {
  await page.route('/api/projects', route => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: '服务器错误' }),
    });
  });
  
  await page.goto('/projects');
  await expect(page.locator('.error-message')).toBeVisible();
});
```

---

## 常见问题

### Q: 测试运行时浏览器无法启动？

**A:** 确保已安装Playwright浏览器：

```bash
npx playwright install
npx playwright install-deps  # Linux系统需要安装系统依赖
```

### Q: 测试偶尔失败？

**A:** 检查以下几点：
1. 是否有足够等待时间
2. 元素是否已可见/可操作
3. 是否存在竞态条件

```typescript
// 使用自动重试断言
await expect(locator).toBeVisible();

// 显式等待
await locator.waitFor({ state: 'visible' });
```

### Q: 如何调试测试？

**A:** 多种调试方式：

```bash
# UI模式（推荐）
pnpm test:e2e:ui

# 查看Trace
npx playwright show-trace trace.zip

# 调试模式
npx playwright test --debug

#headed模式
npx playwright test --headed
```

### Q: 如何跳过某些测试？

**A:** 使用skip或only：

```typescript
test.skip('暂时跳过的测试', async () => {});

test.only('只运行这个测试', async () => {});

test.describe.skip('跳过整个测试组', () => {
  test('测试1', async () => {});
  test('测试2', async () => {});
});
```

### Q: 如何处理文件上传？

**A:** 使用setInputFiles：

```typescript
// 上传单个文件
await page.locator('input[type="file"]').setInputFiles('path/to/file.pdf');

// 上传多个文件
await page.locator('input[type="file"]').setInputFiles([
  'path/to/file1.pdf',
  'path/to/file2.pdf',
]);

// 模拟文件上传（不依赖真实文件）
await page.locator('input[type="file"]').setInputFiles({
  name: 'test.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('test content'),
});
```

### Q: 如何处理新窗口/标签页？

**A:** 使用context.waitForEvent：

```typescript
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target="_blank"]'),
]);

await newPage.waitForLoadState();
await expect(newPage).toHaveURL('/new-page');
```

---

## 参考资料

- [Playwright官方文档](https://playwright.dev/docs/intro)
- [Playwright API参考](https://playwright.dev/docs/api/class-playwright)
- [Playwright最佳实践](https://playwright.dev/docs/best-practices)
- [Faker.js文档](https://fakerjs.dev/)

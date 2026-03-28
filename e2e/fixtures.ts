/**
 * E2E 测试自定义 Fixtures
 * 提供认证、数据库操作等共享功能
 */

import { test as base, Page, APIRequestContext } from '@playwright/test';

// 测试用户类型
export interface TestUser {
  id: number;
  username: string;
  password: string;
  realName: string;
  role: string;
}

// 认证状态
export interface AuthState {
  user: TestUser;
  token: string;
}

// 扩展的测试参数
type TestFixtures = {
  // 已认证的页面
  authenticatedPage: Page;
  // 管理员页面
  adminPage: Page;
  // API请求上下文
  apiContext: APIRequestContext;
  // 测试用户
  testUser: TestUser;
  // 管理员用户
  adminUser: TestUser;
};

// 预设测试用户
const TEST_USERS = {
  admin: {
    id: 1,
    username: 'admin',
    password: 'admin123',
    realName: '系统管理员',
    role: 'admin',
  },
  user: {
    id: 2,
    username: 'testuser',
    password: 'test123456',
    realName: '测试用户',
    role: 'user',
  },
};

// 登录函数
async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // 填写登录表单
  await page.fill('input[id="username"]', user.username);
  await page.fill('input[id="password"]', user.password);
  
  // 点击登录按钮
  await page.click('button[type="submit"]');
  
  // 等待跳转到首页
  await page.waitForURL('/', { timeout: 10000 });
}

// 创建API上下文
async function createApiContext(request: APIRequestContext, user: TestUser): Promise<string> {
  const response = await request.post('/api/auth/login', {
    data: {
      username: user.username,
      password: user.password,
    },
  });
  
  const data = await response.json();
  return data.token || '';
}

// 扩展基础测试
export const test = base.extend<TestFixtures>({
  // 已认证的普通用户页面
  authenticatedPage: async ({ page }, use) => {
    await login(page, TEST_USERS.user);
    await use(page);
  },
  
  // 管理员页面
  adminPage: async ({ page }, use) => {
    await login(page, TEST_USERS.admin);
    await use(page);
  },
  
  // API请求上下文
  apiContext: async ({ request }, use) => {
    await use(request);
  },
  
  // 普通测试用户
  testUser: async ({}, use) => {
    await use(TEST_USERS.user);
  },
  
  // 管理员用户
  adminUser: async ({}, use) => {
    await use(TEST_USERS.admin);
  },
});

export { expect } from '@playwright/test';

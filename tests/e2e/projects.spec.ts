/**
 * E2E 测试示例
 * 使用 Playwright 进行端到端测试
 */

import { test, expect } from '@playwright/test';

test.describe('项目管理', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('应该显示项目列表', async ({ page }) => {
    await page.goto('/projects');

    // 验证页面标题
    await expect(page.locator('h1')).toContainText('项目列表');

    // 验证项目列表存在
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();
  });

  test('应该创建新项目', async ({ page }) => {
    await page.goto('/projects');

    // 点击创建按钮
    await page.click('[data-testid="create-project-button"]');

    // 填写表单
    await page.fill('input[name="name"]', 'E2E测试项目');
    await page.fill('textarea[name="description"]', '这是一个E2E测试项目');
    await page.selectOption('select[name="status"]', 'draft');

    // 提交
    await page.click('button[type="submit"]');

    // 验证成功提示
    await expect(page.locator('[data-testid="toast"]')).toContainText('项目创建成功');

    // 验证跳转到项目详情
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  });

  test('应该编辑项目', async ({ page }) => {
    await page.goto('/projects');

    // 点击第一个项目的编辑按钮
    await page.click('[data-testid="project-list"] tr:first-child [data-testid="edit-button"]');

    // 修改名称
    await page.fill('input[name="name"]', '修改后的项目名称');

    // 提交
    await page.click('button[type="submit"]');

    // 验证成功提示
    await expect(page.locator('[data-testid="toast"]')).toContainText('项目更新成功');
  });

  test('应该删除项目', async ({ page }) => {
    await page.goto('/projects');

    // 获取项目数量
    const projectCountBefore = await page.locator('[data-testid="project-list"] tbody tr').count();

    // 点击第一个项目的删除按钮
    await page.click('[data-testid="project-list"] tr:first-child [data-testid="delete-button"]');

    // 确认删除
    await page.click('[data-testid="confirm-delete-button"]');

    // 验证成功提示
    await expect(page.locator('[data-testid="toast"]')).toContainText('项目删除成功');

    // 验证项目数量减少
    const projectCountAfter = await page.locator('[data-testid="project-list"] tbody tr').count();
    expect(projectCountAfter).toBe(projectCountBefore - 1);
  });

  test('应该搜索项目', async ({ page }) => {
    await page.goto('/projects');

    // 输入搜索关键词
    await page.fill('[data-testid="search-input"]', '测试');

    // 等待搜索结果
    await page.waitForTimeout(500);

    // 验证搜索结果
    const results = await page.locator('[data-testid="project-list"] tbody tr').count();
    expect(results).toBeGreaterThan(0);
  });

  test('应该导出项目列表', async ({ page }) => {
    await page.goto('/projects');

    // 点击导出按钮
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-button"]');

    // 验证下载
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(xlsx|csv)$/);
  });
});

test.describe('用户认证', () => {
  test('应该成功登录', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('应该显示登录错误', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('邮箱或密码错误');
  });

  test('应该成功登出', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // 登出
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    await expect(page).toHaveURL('/login');
  });
});

test.describe('响应式设计', () => {
  test('移动端应该显示汉堡菜单', async ({ page }) => {
    // 设置为移动端视口
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/dashboard');

    // 验证汉堡菜单存在
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // 点击汉堡菜单
    await page.click('[data-testid="mobile-menu-button"]');

    // 验证侧边栏展开
    await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible();
  });

  test('桌面端应该显示完整导航', async ({ page }) => {
    // 设置为桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto('/dashboard');

    // 验证侧边栏始终可见
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-button"]')).not.toBeVisible();
  });
});

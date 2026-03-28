/**
 * 工作台测试
 */

import { test, expect } from '../fixtures';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('工作台', () => {
  test.describe.configure({ mode: 'parallel' });

  test('应该显示工作台页面', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    await dashboardPage.expectLoaded();
  });

  test('应该显示统计卡片', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 验证四个统计卡片
    const projectCount = await dashboardPage.getProjectCount();
    const documentCount = await dashboardPage.getDocumentCount();
    const approvalCount = await dashboardPage.getApprovalCount();
    
    // 验证数值是数字
    expect(typeof projectCount).toBe('number');
    expect(typeof documentCount).toBe('number');
    expect(typeof approvalCount).toBe('number');
  });

  test('应该显示快捷入口', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    await dashboardPage.expectQuickLinksVisible();
    
    // 验证快捷入口项目
    await expect(authenticatedPage.locator('text=项目看板')).toBeVisible();
    await expect(authenticatedPage.locator('text=项目管理')).toBeVisible();
    await expect(authenticatedPage.locator('text=标书文档')).toBeVisible();
    await expect(authenticatedPage.locator('text=审核中心')).toBeVisible();
    await expect(authenticatedPage.locator('text=知识库')).toBeVisible();
    await expect(authenticatedPage.locator('text=AI治理')).toBeVisible();
  });

  test('应该可以点击快捷入口跳转', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 点击项目管理
    await dashboardPage.clickQuickLink('项目管理');
    await expect(authenticatedPage).toHaveURL('/projects');
    
    // 返回工作台
    await dashboardPage.goto();
    
    // 点击知识库
    await dashboardPage.clickQuickLink('知识库');
    await expect(authenticatedPage).toHaveURL('/knowledge');
  });

  test('应该显示待办事项', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 验证待办事项区域显示
    await expect(authenticatedPage.locator('text=待办事项')).toBeVisible();
  });

  test('应该显示最近活动', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 验证最近活动区域显示
    await expect(authenticatedPage.locator('text=最近活动')).toBeVisible();
  });

  test('统计卡片应该可点击跳转', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 点击项目统计卡片
    await authenticatedPage.locator('text=进行中项目').click();
    await expect(authenticatedPage).toHaveURL('/projects');
    
    // 返回并点击待审核卡片
    await dashboardPage.goto();
    await authenticatedPage.locator('text=待审核').click();
    await expect(authenticatedPage).toHaveURL('/approval');
  });

  test('应该可以新建项目', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 点击新建项目按钮
    await authenticatedPage.locator('button:has-text("新建项目")').click();
    
    // 验证跳转到新建项目页面或打开对话框
    const url = authenticatedPage.url();
    expect(url).toContain('/projects');
  });

  test('应该可以新建标书', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 点击新建标书按钮
    await authenticatedPage.locator('button:has-text("新建标书")').click();
    
    // 验证跳转到标书页面
    await expect(authenticatedPage).toHaveURL('/bid');
  });
});

test.describe('工作台响应式布局', () => {
  test('移动端应该正确显示', async ({ page, testUser }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 登录
    await page.goto('/login');
    await page.fill('input[id="username"]', testUser.username);
    await page.fill('input[id="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });
    
    // 验证工作台显示
    await expect(page.locator('h1:has-text("工作台")')).toBeVisible();
    
    // 验证统计卡片堆叠显示
    const cards = page.locator('[class*="grid"]');
    await expect(cards.first()).toBeVisible();
  });

  test('平板端应该正确显示', async ({ page, testUser }) => {
    // 设置平板端视口
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/login');
    await page.fill('input[id="username"]', testUser.username);
    await page.fill('input[id="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 10000 });
    
    // 验证工作台显示
    await expect(page.locator('h1:has-text("工作台")')).toBeVisible();
  });
});

test.describe('工作台数据刷新', () => {
  test('刷新页面后数据应该保持一致', async ({ authenticatedPage }) => {
    const dashboardPage = new DashboardPage(authenticatedPage);
    await dashboardPage.goto();
    
    // 获取初始数据
    const initialProjectCount = await dashboardPage.getProjectCount();
    
    // 刷新页面
    await authenticatedPage.reload();
    await dashboardPage.expectLoaded();
    
    // 验证数据一致
    const newProjectCount = await dashboardPage.getProjectCount();
    expect(newProjectCount).toBe(initialProjectCount);
  });
});

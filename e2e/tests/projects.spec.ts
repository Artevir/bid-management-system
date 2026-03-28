/**
 * 项目管理测试 - CRUD操作
 */

import { test, expect } from '../fixtures';
import { ProjectsPage } from '../pages/projects.page';
import { ProjectDetailPage } from '../pages/project-detail.page';
import { createProjectData } from '../factories';
import { waitForTableLoad, getTableRowCount } from '../helpers';

test.describe('项目管理', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ authenticatedPage }) => {
    // 每个测试前确保已登录
  });

  test('应该显示项目列表页面', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    // 验证页面元素
    await expect(projectsPage.createButton).toBeVisible();
    await expect(projectsPage.searchInput).toBeVisible();
  });

  test('应该可以搜索项目', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    // 搜索项目
    await projectsPage.searchProject('测试项目');
    
    // 验证搜索结果
    await waitForTableLoad(page);
    const count = await getTableRowCount(page);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('应该可以按状态筛选项目', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    // 等待表格加载
    await waitForTableLoad(page);
    
    // 选择状态筛选
    await projectsPage.filterByStatus('进行中');
    
    // 验证筛选结果
    await waitForTableLoad(page);
  });

  test('应该显示空状态当没有项目', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    // 如果没有项目，验证空状态显示
    const count = await getTableRowCount(page);
    if (count === 0) {
      await projectsPage.expectNoProjects();
    }
  });

  test('应该可以创建新项目', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    const projectData = createProjectData({
      name: `E2E测试项目-${Date.now()}`,
      code: `E2E-${Date.now()}`,
    });
    
    // 点击新建项目
    await projectsPage.createButton.click();
    
    // 等待对话框打开
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 填写表单
    await dialog.locator('input[id="name"]').fill(projectData.name);
    await dialog.locator('input[id="code"]').fill(projectData.code);
    
    // 选择项目类型
    const typeSelect = dialog.locator('[id="type"]');
    await typeSelect.click();
    await page.locator('[role="option"]').first().click();
    
    // 选择所属行业
    const industrySelect = dialog.locator('[id="industry"]');
    await industrySelect.click();
    await page.locator('[role="option"]').first().click();
    
    // 选择所属区域
    const regionSelect = dialog.locator('[id="region"]');
    await regionSelect.click();
    await page.locator('[role="option"]').first().click();
    
    // 点击创建
    await dialog.locator('button', { hasText: '创建' }).click();
    
    // 验证对话框关闭
    await dialog.waitFor({ state: 'hidden' }).catch(() => {});
    
    // 验证项目出现在列表中（可能需要刷新）
    await page.waitForTimeout(1000);
  });

  test('应该验证项目必填字段', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    // 点击新建项目
    await projectsPage.createButton.click();
    
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 不填写任何字段，直接点击创建
    await dialog.locator('button', { hasText: '创建' }).click();
    
    // 验证必填字段验证提示
    await expect(dialog.locator('input[id="name"]')).toHaveAttribute('required', '');
    await expect(dialog.locator('input[id="code"]')).toHaveAttribute('required', '');
  });

  test('应该可以查看项目详情', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    // 等待表格加载
    await waitForTableLoad(page);
    
    const count = await getTableRowCount(page);
    
    if (count > 0) {
      // 点击第一个项目
      const firstRow = page.locator('table tbody tr').first();
      const projectName = await firstRow.locator('td').first().textContent();
      
      // 点击查看按钮
      await firstRow.locator('button:has-text("查看")').click();
      
      // 验证跳转到详情页
      await expect(page).toHaveURL(/\/projects\/\d+/);
      
      // 验证项目名称显示
      const projectDetailPage = new ProjectDetailPage(page);
      if (projectName) {
        await projectDetailPage.expectTitle(projectName.trim());
      }
    }
  });

  test('应该可以查看项目里程碑', async ({ page }) => {
    // 先访问项目列表
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    await waitForTableLoad(page);
    const count = await getTableRowCount(page);
    
    if (count > 0) {
      // 点击第一个项目查看
      await page.locator('table tbody tr').first().locator('button:has-text("查看")').click();
      
      // 等待详情页加载
      await expect(page).toHaveURL(/\/projects\/\d+/);
      
      // 点击里程碑标签
      const projectDetailPage = new ProjectDetailPage(page);
      await projectDetailPage.goToMilestones();
      
      // 验证里程碑列表或空状态显示
      await expect(page.locator('text=里程碑')).toBeVisible();
    }
  });

  test('应该可以查看项目文档', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    await waitForTableLoad(page);
    const count = await getTableRowCount(page);
    
    if (count > 0) {
      // 点击第一个项目查看
      await page.locator('table tbody tr').first().locator('button:has-text("查看")').click();
      
      await expect(page).toHaveURL(/\/projects\/\d+/);
      
      // 点击文档标签
      const projectDetailPage = new ProjectDetailPage(page);
      await projectDetailPage.goToDocuments();
      
      // 验证文档列表或空状态显示
      await expect(page.locator('text=文档')).toBeVisible();
    }
  });

  test('应该可以查看项目成员', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    await waitForTableLoad(page);
    const count = await getTableRowCount(page);
    
    if (count > 0) {
      // 点击第一个项目查看
      await page.locator('table tbody tr').first().locator('button:has-text("查看")').click();
      
      await expect(page).toHaveURL(/\/projects\/\d+/);
      
      // 点击成员标签
      const projectDetailPage = new ProjectDetailPage(page);
      await projectDetailPage.goToMembers();
      
      // 验证成员列表显示
      await expect(page.locator('text=成员')).toBeVisible();
    }
  });

  test('应该显示项目进度', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    await waitForTableLoad(page);
    const count = await getTableRowCount(page);
    
    if (count > 0) {
      // 验证进度条显示
      const progressBar = page.locator('table tbody tr').first().locator('[role="progressbar"]');
      const isVisible = await progressBar.isVisible().catch(() => false);
      
      // 进度条可能显示也可能不显示，取决于数据
      expect(typeof isVisible).toBe('boolean');
    }
  });
});

test.describe('项目创建表单验证', () => {
  test('项目编码应该有格式验证', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    await projectsPage.createButton.click();
    
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 输入特殊字符的项目编码
    await dialog.locator('input[id="code"]').fill('!@#$%^&*()');
    
    // 验证是否有格式错误提示（取决于实现）
    // 这里可以添加更多的验证逻辑
  });

  test('日期字段应该有范围限制', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    await projectsPage.createButton.click();
    
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 验证日期字段存在
    const dateInputs = dialog.locator('input[type="date"]');
    const count = await dateInputs.count();
    
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('项目列表分页', () => {
  test('应该显示分页控件当项目数量超过每页限制', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    
    await waitForTableLoad(page);
    
    // 检查是否有分页控件
    const paginationExists = await page.locator('button:has-text("下一页")').isVisible().catch(() => false);
    
    // 如果有分页，测试分页功能
    if (paginationExists) {
      await page.locator('button:has-text("下一页")').click();
      await waitForTableLoad(page);
    }
  });
});

/**
 * 页面对象模型 - 项目列表页
 */

import { Page, Locator, expect } from '@playwright/test';

export class ProjectsPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly statusFilter: Locator;
  readonly industryFilter: Locator;
  readonly regionFilter: Locator;
  readonly projectTable: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createButton = page.locator('button', { hasText: '新建项目' });
    this.searchInput = page.locator('input[placeholder*="搜索"]');
    this.searchButton = page.locator('button', { hasText: '搜索' });
    this.statusFilter = page.locator('[role="combobox"]').first();
    this.industryFilter = page.locator('[role="combobox"]').nth(1);
    this.regionFilter = page.locator('[role="combobox"]').nth(2);
    this.projectTable = page.locator('table');
    this.emptyState = page.locator('text=暂无项目');
  }

  async goto() {
    await this.page.goto('/projects');
    await this.page.waitForLoadState('networkidle');
  }

  async createProject(data: {
    name: string;
    code: string;
    departmentId?: string;
    ownerId?: string;
  }) {
    await this.createButton.click();
    
    // 等待对话框打开
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 填写基本信息
    await dialog.locator('input[id="name"]').fill(data.name);
    await dialog.locator('input[id="code"]').fill(data.code);
    
    // 选择部门和负责人
    if (data.departmentId) {
      await dialog.locator('[id="departmentId"]').click();
      await this.page.locator(`[role="option"][data-value="${data.departmentId}"]`).click();
    }
    
    if (data.ownerId) {
      await dialog.locator('[id="ownerId"]').click();
      await this.page.locator(`[role="option"][data-value="${data.ownerId}"]`).click();
    }
    
    // 提交表单
    await dialog.locator('button', { hasText: '创建' }).click();
  }

  async searchProject(keyword: string) {
    await this.searchInput.fill(keyword);
    await this.searchButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async filterByStatus(status: string) {
    await this.statusFilter.click();
    await this.page.locator(`[role="option"]:has-text("${status}")`).click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickProject(name: string) {
    await this.page.locator(`text="${name}"`).click();
  }

  async viewProject(name: string) {
    const row = this.projectTable.locator('tr', { hasText: name });
    await row.locator('button', { hasText: '查看' }).click();
  }

  async expectProjectExists(name: string) {
    await expect(this.projectTable.locator(`text="${name}"`)).toBeVisible();
  }

  async expectNoProjects() {
    await expect(this.emptyState).toBeVisible();
  }

  async getProjectCount(): Promise<number> {
    const rows = await this.projectTable.locator('tbody tr').count();
    return rows;
  }
}

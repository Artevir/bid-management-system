/**
 * 页面对象模型 - 项目详情页
 */

import { Page, Locator, expect } from '@playwright/test';

export class ProjectDetailPage {
  readonly page: Page;
  readonly projectTitle: Locator;
  readonly projectStatus: Locator;
  readonly progressBar: Locator;
  readonly tabs: Locator;
  readonly milestonesTab: Locator;
  readonly documentsTab: Locator;
  readonly membersTab: Locator;
  readonly addMilestoneButton: Locator;
  readonly addDocumentButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectTitle = page.locator('h1');
    this.projectStatus = page.locator('[data-testid="project-status"]');
    this.progressBar = page.locator('[role="progressbar"]');
    this.tabs = page.locator('[role="tablist"]');
    this.milestonesTab = page.locator('[role="tab"]', { hasText: '里程碑' });
    this.documentsTab = page.locator('[role="tab"]', { hasText: '文档' });
    this.membersTab = page.locator('[role="tab"]', { hasText: '成员' });
    this.addMilestoneButton = page.locator('button', { hasText: '添加里程碑' });
    this.addDocumentButton = page.locator('button', { hasText: '新建文档' });
  }

  async goto(projectId: number) {
    await this.page.goto(`/projects/${projectId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async goToMilestones() {
    await this.milestonesTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToDocuments() {
    await this.documentsTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  async goToMembers() {
    await this.membersTab.click();
    await this.page.waitForLoadState('networkidle');
  }

  async addMilestone(data: { name: string; dueDate?: string }) {
    await this.addMilestoneButton.click();
    
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    await dialog.locator('input[id="name"]').fill(data.name);
    
    if (data.dueDate) {
      await dialog.locator('input[type="date"]').fill(data.dueDate);
    }
    
    await dialog.locator('button', { hasText: '创建' }).click();
  }

  async expectTitle(title: string) {
    await expect(this.projectTitle).toContainText(title);
  }

  async expectProgress(value: number) {
    const progress = await this.progressBar.getAttribute('aria-valuenow');
    expect(parseInt(progress || '0')).toBeGreaterThanOrEqual(value);
  }
}

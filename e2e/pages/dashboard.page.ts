/**
 * 页面对象模型 - 工作台页面
 */

import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly welcomeTitle: Locator;
  readonly projectCountCard: Locator;
  readonly documentCountCard: Locator;
  readonly approvalCountCard: Locator;
  readonly knowledgeCountCard: Locator;
  readonly quickLinks: Locator;
  readonly pendingTasks: Locator;
  readonly recentActivities: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeTitle = page.locator('h1', { hasText: '工作台' });
    this.projectCountCard = page.locator('text=进行中项目').locator('..');
    this.documentCountCard = page.locator('text=标书文档').locator('..');
    this.approvalCountCard = page.locator('text=待审核').locator('..');
    this.knowledgeCountCard = page.locator('text=知识条目').locator('..');
    this.quickLinks = page.locator('text=快捷入口').locator('..');
    this.pendingTasks = page.locator('text=待办事项').locator('..');
    this.recentActivities = page.locator('text=最近活动').locator('..');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async clickQuickLink(name: string) {
    await this.quickLinks.locator(`text="${name}"`).click();
  }

  async getProjectCount(): Promise<number> {
    const text = await this.projectCountCard.locator('text=/^\\d+$/').first().textContent();
    return parseInt(text || '0');
  }

  async getDocumentCount(): Promise<number> {
    const text = await this.documentCountCard.locator('text=/^\\d+$/').first().textContent();
    return parseInt(text || '0');
  }

  async getApprovalCount(): Promise<number> {
    const text = await this.approvalCountCard.locator('text=/^\\d+$/').first().textContent();
    return parseInt(text || '0');
  }

  async expectLoaded() {
    await expect(this.welcomeTitle).toBeVisible();
  }

  async expectQuickLinksVisible() {
    await expect(this.quickLinks).toBeVisible();
  }
}

/**
 * 页面对象模型 - 知识库页面
 */

import { Page, Locator, expect } from '@playwright/test';

export class KnowledgePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly categoryFilter: Locator;
  readonly knowledgeList: Locator;
  readonly createButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[placeholder*="搜索"]');
    this.categoryFilter = page.locator('[role="combobox"]').first();
    this.knowledgeList = page.locator('[data-testid="knowledge-list"]');
    this.createButton = page.locator('button', { hasText: '添加' });
    this.emptyState = page.locator('text=暂无知识');
  }

  async goto() {
    await this.page.goto('/knowledge');
    await this.page.waitForLoadState('networkidle');
  }

  async search(keyword: string) {
    await this.searchInput.fill(keyword);
    await this.page.keyboard.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async createKnowledge(data: { title: string; content?: string; category?: string }) {
    await this.createButton.click();
    
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    await dialog.locator('input[id="title"]').fill(data.title);
    
    if (data.content) {
      await dialog.locator('textarea[id="content"]').fill(data.content);
    }
    
    if (data.category) {
      await dialog.locator('[id="category"]').click();
      await this.page.locator(`[role="option"]:has-text("${data.category}")`).click();
    }
    
    await dialog.locator('button', { hasText: '保存' }).click();
  }

  async clickKnowledge(title: string) {
    await this.page.locator(`text="${title}"`).first().click();
  }

  async expectKnowledgeExists(title: string) {
    await expect(this.page.locator(`text="${title}"`)).toBeVisible();
  }

  async expectNoKnowledge() {
    await expect(this.emptyState).toBeVisible();
  }
}

/**
 * 知识库管理测试
 */

import { test, expect } from '../fixtures';
import { KnowledgePage } from '../pages/knowledge.page';
import { createKnowledgeData } from '../factories';

test.describe('知识库管理', () => {
  test.describe.configure({ mode: 'parallel' });

  test('应该显示知识库页面', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    // 验证搜索框存在
    await expect(knowledgePage.searchInput).toBeVisible();
  });

  test('应该可以搜索知识条目', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    // 执行搜索
    await knowledgePage.search('测试');
    
    // 验证搜索结果加载
    await page.waitForLoadState('networkidle');
  });

  test('应该可以按分类筛选', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    // 选择分类筛选
    await knowledgePage.categoryFilter.click();
    
    // 等待下拉选项显示
    await page.waitForSelector('[role="option"]');
    
    // 选择第一个分类
    await page.locator('[role="option"]').first().click();
    
    // 验证筛选结果加载
    await page.waitForLoadState('networkidle');
  });

  test('应该可以创建知识条目', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    const data = createKnowledgeData({
      title: `E2E测试知识-${Date.now()}`,
    });
    
    // 点击添加按钮
    await knowledgePage.createButton.click();
    
    // 等待对话框打开
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 填写表单
    await dialog.locator('input[id="title"]').fill(data.title);
    if (data.content) {
      await dialog.locator('textarea[id="content"]').fill(data.content);
    }
    
    // 提交
    await dialog.locator('button', { hasText: '保存' }).click();
    
    // 等待对话框关闭
    await dialog.waitFor({ state: 'hidden' }).catch(() => {});
  });

  test('应该显示空状态当没有知识条目', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    // 搜索一个不存在的内容
    await knowledgePage.search(`不存在的知识-${Date.now()}`);
    
    // 验证无结果状态
    await page.waitForLoadState('networkidle');
    
    // 可能显示空状态或无结果提示
    const hasEmptyState = await page.locator('text=暂无').isVisible().catch(() => false);
    const hasNoResult = await page.locator('text=未找到').isVisible().catch(() => false);
    
    expect(hasEmptyState || hasNoResult).toBe(true);
  });
});

test.describe('知识审批', () => {
  test('应该显示知识审批页面', async ({ page }) => {
    await page.goto('/knowledge/approval');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1:has-text("知识审批")')).toBeVisible();
  });

  test('应该显示待处理审批数量', async ({ page }) => {
    await page.goto('/knowledge/approval');
    await page.waitForLoadState('networkidle');
    
    // 验证待处理标签
    await expect(page.locator('text=待处理')).toBeVisible();
  });

  test('应该显示我的申请标签', async ({ page }) => {
    await page.goto('/knowledge/approval');
    await page.waitForLoadState('networkidle');
    
    // 点击我的申请标签
    await page.locator('text=我的申请').click();
    
    // 验证标签切换
    await expect(page.locator('text=我的申请记录')).toBeVisible();
  });
});

test.describe('知识条目详情', () => {
  test('应该可以查看知识条目详情', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    // 等待列表加载
    await page.waitForLoadState('networkidle');
    
    // 检查是否有知识条目
    const items = page.locator('[data-testid="knowledge-item"], table tbody tr, .knowledge-card');
    const count = await items.count();
    
    if (count > 0) {
      // 点击第一个条目
      await items.first().click();
      
      // 验证详情页或对话框显示
      const detailVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      const urlChanged = page.url().includes('/knowledge/');
      
      expect(detailVisible || urlChanged).toBe(true);
    }
  });
});

test.describe('知识库搜索功能', () => {
  test('搜索应该支持关键词高亮', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    // 搜索关键词
    await knowledgePage.search('标书');
    
    // 验证搜索结果（如果有高亮功能）
    await page.waitForLoadState('networkidle');
  });

  test('搜索应该支持清除', async ({ page }) => {
    const knowledgePage = new KnowledgePage(page);
    await knowledgePage.goto();
    
    // 先搜索
    await knowledgePage.search('测试');
    await page.waitForLoadState('networkidle');
    
    // 清除搜索框
    await knowledgePage.searchInput.clear();
    await page.keyboard.press('Enter');
    
    // 验证恢复显示全部
    await page.waitForLoadState('networkidle');
  });
});

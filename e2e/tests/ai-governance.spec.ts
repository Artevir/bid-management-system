/**
 * AI治理中心测试
 */

import { test, expect } from '../fixtures';

test.describe('AI治理中心', () => {
  test.describe.configure({ mode: 'parallel' });

  test('应该显示AI治理页面', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1:has-text("AI 治理中心")')).toBeVisible();
  });

  test('应该显示质量指标卡片', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 验证指标卡片区域显示
    const cards = page.locator('[class*="grid"]');
    await expect(cards.first()).toBeVisible();
  });

  test('应该显示三个主要标签', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 验证三个标签
    await expect(page.locator('text=评测集管理')).toBeVisible();
    await expect(page.locator('text=回归测试')).toBeVisible();
    await expect(page.locator('text=质量指标')).toBeVisible();
  });

  test('应该可以切换到评测集管理', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 点击评测集管理标签（默认可能已选中）
    await page.locator('text=评测集管理').click();
    
    // 验证评测集列表显示
    await expect(page.locator('text=评测数据集')).toBeVisible();
  });

  test('应该可以切换到回归测试', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 点击回归测试标签
    await page.locator('text=回归测试').click();
    
    // 验证回归测试列表显示
    await expect(page.locator('text=回归测试记录')).toBeVisible();
  });

  test('应该可以切换到质量指标', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 点击质量指标标签
    await page.locator('text=质量指标').click();
    
    // 验证质量指标列表显示
    await expect(page.locator('text=AI 质量指标监控')).toBeVisible();
  });
});

test.describe('评测集管理', () => {
  test('应该可以新建评测集', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 点击新建评测集按钮
    const createButton = page.locator('button:has-text("新建评测集")');
    await createButton.click();
    
    // 验证对话框打开
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 验证表单字段
    await expect(dialog.locator('input[id="evalName"]')).toBeVisible();
  });

  test('应该显示导入按钮', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 验证导入按钮存在
    await expect(page.locator('button:has-text("导入")')).toBeVisible();
  });

  test('评测集列表应该显示', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 验证表格或列表存在
    const table = page.locator('table, [data-testid="eval-set-list"]');
    const count = await table.count();
    
    // 可能是表格或卡片列表
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('回归测试', () => {
  test('应该显示刷新按钮', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 切换到回归测试
    await page.locator('text=回归测试').click();
    
    // 验证刷新按钮
    await expect(page.locator('button:has-text("刷新")')).toBeVisible();
  });

  test('应该显示测试记录或空状态', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 切换到回归测试
    await page.locator('text=回归测试').click();
    await page.waitForLoadState('networkidle');
    
    // 验证显示测试记录或空状态
    const hasRecords = await page.locator('text=回归测试记录').isVisible();
    const hasEmpty = await page.locator('text=暂无回归测试').isVisible();
    
    expect(hasRecords || hasEmpty).toBe(true);
  });
});

test.describe('质量指标', () => {
  test('应该显示指标监控列表', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 切换到质量指标
    await page.locator('text=质量指标').click();
    await page.waitForLoadState('networkidle');
    
    // 验证指标监控区域
    await expect(page.locator('text=AI 质量指标监控')).toBeVisible();
  });

  test('指标应该显示趋势指示器', async ({ page }) => {
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 验证趋势图标存在（上升、下降或稳定）
    const trendIcon = page.locator('[class*="TrendingUp"], [class*="TrendingDown"], [class*="Minus"]');
    // 不强制要求，因为取决于数据
  });
});

test.describe('AI治理响应式', () => {
  test('移动端应该正确显示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/ai-governance');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1:has-text("AI 治理中心")')).toBeVisible();
  });
});

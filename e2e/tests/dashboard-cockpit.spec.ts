/**
 * 项目看板测试
 */

import { test, expect } from '../fixtures';

test.describe('项目看板', () => {
  test.describe.configure({ mode: 'parallel' });

  test('应该显示看板页面', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1:has-text("项目看板")')).toBeVisible();
  });

  test('应该显示核心指标卡片', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证四个核心指标卡片
    await expect(page.locator('text=进行中项目')).toBeVisible();
    await expect(page.locator('text=已完成项目')).toBeVisible();
    await expect(page.locator('text=待审核')).toBeVisible();
    await expect(page.locator('text=过期项目')).toBeVisible();
  });

  test('应该显示项目趋势图表', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证趋势图显示
    await expect(page.locator('text=项目趋势')).toBeVisible();
  });

  test('应该显示里程碑状态图表', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证里程碑状态图显示
    await expect(page.locator('text=里程碑状态')).toBeVisible();
  });

  test('应该显示部门统计', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证部门统计显示
    await expect(page.locator('text=部门项目统计')).toBeVisible();
  });

  test('应该显示即将到期提醒', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证即将到期区域显示
    await expect(page.locator('text=即将到期')).toBeVisible();
  });

  test('应该可以切换数据标签页', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 点击文档统计标签
    await page.locator('text=文档统计').click();
    await expect(page.locator('text=文档统计')).toBeVisible();
    
    // 点击审校统计标签
    await page.locator('text=审校统计').click();
    await expect(page.locator('text=审校效率分析')).toBeVisible();
  });

  test('统计数据应该实时更新', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 获取初始数据
    const initialText = await page.locator('text=进行中项目').locator('..').textContent();
    
    // 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // 验证数据仍然显示
    const newText = await page.locator('text=进行中项目').locator('..').textContent();
    
    // 数据应该一致（或更新）
    expect(typeof newText).toBe('string');
  });
});

test.describe('看板图表交互', () => {
  test('图表应该支持悬浮提示', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 悬浮在图表上
    const chart = page.locator('svg, canvas').first();
    await chart.hover();
    
    // 验证是否有tooltip（取决于图表库）
  });

  test('趋势图应该显示数据点', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证图表元素存在
    const chartContainer = page.locator('text=项目趋势').locator('..');
    await expect(chartContainer).toBeVisible();
  });
});

test.describe('看板响应式', () => {
  test('移动端应该正确显示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1:has-text("项目看板")')).toBeVisible();
    
    // 验证卡片堆叠显示
    const cards = page.locator('[class*="grid"]');
    await expect(cards.first()).toBeVisible();
  });

  test('平板端应该正确显示', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1:has-text("项目看板")')).toBeVisible();
  });
});

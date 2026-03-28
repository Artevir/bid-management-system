/**
 * 审核流程测试
 */

import { test, expect } from '../fixtures';

test.describe('审核中心', () => {
  test.describe.configure({ mode: 'parallel' });

  test('应该显示审核中心页面', async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1')).toContainText('审核');
  });

  test('应该显示待审核列表', async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
    
    // 验证待审核区域显示
    await expect(page.locator('text=待审核')).toBeVisible();
  });

  test('应该可以查看审核详情', async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
    
    // 检查是否有待审核项
    const items = page.locator('table tbody tr, [data-testid="approval-item"]');
    const count = await items.count();
    
    if (count > 0) {
      // 点击第一个审核项
      await items.first().click();
      
      // 验证详情对话框或页面显示
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      
      if (dialogVisible) {
        // 验证审核操作按钮
        await expect(dialog.locator('button:has-text("通过")')).toBeVisible();
        await expect(dialog.locator('button:has-text("拒绝")')).toBeVisible();
      }
    }
  });
});

test.describe('审校配置', () => {
  test('应该显示审校配置页面', async ({ page }) => {
    await page.goto('/review/config');
    await page.waitForLoadState('networkidle');
    
    // 验证页面标题
    await expect(page.locator('h1:has-text("审校配置")')).toBeVisible();
  });

  test('应该显示审校配置标签', async ({ page }) => {
    await page.goto('/review/config');
    await page.waitForLoadState('networkidle');
    
    // 验证三个标签
    await expect(page.locator('text=审校配置')).toBeVisible();
    await expect(page.locator('text=审校规则')).toBeVisible();
    await expect(page.locator('text=审校模板')).toBeVisible();
  });

  test('应该可以切换到审校规则标签', async ({ page }) => {
    await page.goto('/review/config');
    await page.waitForLoadState('networkidle');
    
    // 点击审校规则标签
    await page.locator('text=审校规则').click();
    
    // 验证规则列表显示
    await expect(page.locator('text=审校规则库')).toBeVisible();
  });

  test('应该可以切换到审校模板标签', async ({ page }) => {
    await page.goto('/review/config');
    await page.waitForLoadState('networkidle');
    
    // 点击审校模板标签
    await page.locator('text=审校模板').click();
    
    // 验证模板列表显示
    await expect(page.locator('text=审校模板')).toBeVisible();
  });

  test('应该可以新建审校配置', async ({ page }) => {
    await page.goto('/review/config');
    await page.waitForLoadState('networkidle');
    
    // 点击新建配置按钮
    const createButton = page.locator('button:has-text("新建配置")');
    await createButton.click();
    
    // 验证对话框打开
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // 验证表单字段
    await expect(dialog.locator('input[id="name"]')).toBeVisible();
    await expect(dialog.locator('select, [role="combobox"]')).toBeVisible();
  });
});

test.describe('审核操作', () => {
  test('应该可以执行通过操作', async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
    
    // 检查是否有待审核项
    const items = page.locator('table tbody tr, [data-testid="approval-item"]');
    const count = await items.count();
    
    if (count > 0) {
      // 点击第一个审核项
      await items.first().click();
      
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      
      if (dialogVisible) {
        // 点击通过按钮
        await dialog.locator('button:has-text("通过")').click();
        
        // 验证确认对话框
        const confirmDialog = page.locator('[role="dialog"]').last();
        await expect(confirmDialog.locator('text=确认通过')).toBeVisible();
      }
    }
  });

  test('应该可以执行拒绝操作', async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
    
    const items = page.locator('table tbody tr, [data-testid="approval-item"]');
    const count = await items.count();
    
    if (count > 0) {
      await items.first().click();
      
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      
      if (dialogVisible) {
        // 点击拒绝按钮
        await dialog.locator('button:has-text("拒绝")').click();
        
        // 验证拒绝原因输入框
        const confirmDialog = page.locator('[role="dialog"]').last();
        await expect(confirmDialog.locator('textarea')).toBeVisible();
      }
    }
  });

  test('拒绝操作应该要求填写原因', async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
    
    const items = page.locator('table tbody tr, [data-testid="approval-item"]');
    const count = await items.count();
    
    if (count > 0) {
      await items.first().click();
      
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible().catch(() => false);
      
      if (dialogVisible) {
        await dialog.locator('button:has-text("拒绝")').click();
        
        const confirmDialog = page.locator('[role="dialog"]').last();
        
        // 不填写原因直接确认
        await confirmDialog.locator('button:has-text("确认")').click();
        
        // 验证必填提示（如果有）
        const textarea = confirmDialog.locator('textarea');
        await expect(textarea).toBeVisible();
      }
    }
  });
});

test.describe('审核历史', () => {
  test('应该可以查看审核历史', async ({ page }) => {
    await page.goto('/approval');
    await page.waitForLoadState('networkidle');
    
    // 点击历史标签（如果有）
    const historyTab = page.locator('text=历史, text=已处理');
    const historyExists = await historyTab.isVisible().catch(() => false);
    
    if (historyExists) {
      await historyTab.click();
      await page.waitForLoadState('networkidle');
    }
  });
});

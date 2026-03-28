/**
 * E2E 测试辅助函数
 */

import { Page, expect } from '@playwright/test';

/**
 * 等待页面加载完成
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

/**
 * 检查元素是否可见
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.locator(selector).waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查元素是否存在
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  const count = await page.locator(selector).count();
  return count > 0;
}

/**
 * 点击下拉选项
 */
export async function selectDropdownOption(
  page: Page,
  triggerSelector: string,
  optionText: string
) {
  await page.locator(triggerSelector).click();
  await page.locator(`[role="option"]:has-text("${optionText}")`).click();
}

/**
 * 填写表单字段
 */
export async function fillFormField(
  page: Page,
  fieldId: string,
  value: string
) {
  await page.locator(`[id="${fieldId}"]`).fill(value);
}

/**
 * 提交表单
 */
export async function submitForm(page: Page, buttonText = '提交') {
  await page.locator(`button:has-text("${buttonText}")`).click();
}

/**
 * 等待对话框打开
 */
export async function waitForDialog(page: Page) {
  await page.locator('[role="dialog"]').waitFor({ state: 'visible' });
}

/**
 * 等待对话框关闭
 */
export async function waitForDialogClose(page: Page) {
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
}

/**
 * 关闭对话框
 */
export async function closeDialog(page: Page) {
  await page.locator('[role="dialog"] button[aria-label="Close"]').click();
}

/**
 * 检查Toast消息
 */
export async function expectToastMessage(page: Page, message: string) {
  await expect(page.locator('[role="status"], [data-sonner-toast]')).toContainText(message, {
    timeout: 10000,
  });
}

/**
 * 等待表格加载
 */
export async function waitForTableLoad(page: Page) {
  await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * 获取表格行数
 */
export async function getTableRowCount(page: Page): Promise<number> {
  return await page.locator('table tbody tr').count();
}

/**
 * 点击表格行中的按钮
 */
export async function clickTableRowButton(
  page: Page,
  rowText: string,
  buttonText: string
) {
  const row = page.locator('table tbody tr', { hasText: rowText });
  await row.locator(`button:has-text("${buttonText}")`).click();
}

/**
 * 分页导航
 */
export async function navigateToPage(page: Page, pageNumber: number) {
  await page.locator(`button:has-text("${pageNumber}")`).click();
  await waitForPageReady(page);
}

/**
 * 截图调试
 */
export async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/debug-${name}.png`, fullPage: true });
}

/**
 * 模拟文件上传
 */
export async function uploadFile(
  page: Page,
  inputSelector: string,
  filePath: string
) {
  const fileInput = page.locator(inputSelector);
  await fileInput.setInputFiles(filePath);
}

/**
 * 等待API响应
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForResponse(response => 
    typeof urlPattern === 'string'
      ? response.url().includes(urlPattern)
      : urlPattern.test(response.url())
  );
}

/**
 * Mock API响应
 */
export async function mockAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: any,
  status = 200
) {
  await page.route(
    typeof urlPattern === 'string' ? `**${urlPattern}` : urlPattern,
    route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    }
  );
}

/**
 * 清除所有Mock
 */
export async function clearAllMocks(page: Page) {
  await page.unrouteAll();
}

/**
 * 检查页面是否重定向到登录页
 */
export async function expectRedirectToLogin(page: Page) {
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
}

/**
 * 检查页面是否重定向到首页
 */
export async function expectRedirectToHome(page: Page) {
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

/**
 * 生成测试文件路径
 */
export function getTestFilePath(fileName: string): string {
  return `./e2e/fixtures/${fileName}`;
}

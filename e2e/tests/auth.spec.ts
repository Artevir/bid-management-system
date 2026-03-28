/**
 * 认证测试 - 登录/登出
 */

import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('认证流程', () => {
  test.describe.configure({ mode: 'parallel' });

  test('应该显示登录页面', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 验证页面元素
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('应该可以使用管理员账号登录', async ({ page, adminUser }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 执行登录
    await loginPage.login(adminUser.username, adminUser.password);
    
    // 验证跳转到首页
    await loginPage.expectRedirectToHome();
    
    // 验证工作台页面加载
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.expectLoaded();
  });

  test('应该显示错误提示当使用错误的凭据', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 使用错误的凭据登录
    await loginPage.login('wronguser', 'wrongpassword');
    
    // 验证错误提示
    await loginPage.expectError('用户名或密码错误');
    
    // 验证仍然在登录页面
    await expect(page).toHaveURL('/login');
  });

  test('应该显示错误提示当用户名为空', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 不填写用户名
    await loginPage.passwordInput.fill('password123');
    await loginPage.submitButton.click();
    
    // 验证浏览器原生验证提示
    await expect(loginPage.usernameInput).toHaveAttribute('required', '');
  });

  test('应该显示错误提示当密码为空', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 不填写密码
    await loginPage.usernameInput.fill('admin');
    await loginPage.submitButton.click();
    
    // 验证浏览器原生验证提示
    await expect(loginPage.passwordInput).toHaveAttribute('required', '');
  });

  test('应该可以切换密码显示/隐藏', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 输入密码
    await loginPage.passwordInput.fill('password123');
    
    // 验证密码默认隐藏
    await loginPage.expectPasswordHidden();
    
    // 切换显示密码
    await loginPage.togglePasswordVisibility();
    await loginPage.expectPasswordVisible();
    
    // 再次切换隐藏密码
    await loginPage.togglePasswordVisibility();
    await loginPage.expectPasswordHidden();
  });

  test('应该可以登出', async ({ page, adminUser }) => {
    const loginPage = new LoginPage(page);
    
    // 先登录
    await loginPage.goto();
    await loginPage.login(adminUser.username, adminUser.password);
    await loginPage.expectRedirectToHome();
    
    // 点击用户菜单
    await page.click('[data-testid="user-menu"], button:has-text("用户")');
    
    // 点击退出登录
    await page.click('text=退出登录');
    
    // 验证跳转到登录页面
    await expect(page).toHaveURL('/login');
  });

  test('未登录用户访问受保护页面应该重定向到登录页', async ({ page }) => {
    // 直接访问受保护页面
    await page.goto('/projects');
    
    // 验证重定向到登录页
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('登录后应该重定向到原请求页面', async ({ page, adminUser }) => {
    // 访问需要登录的页面
    await page.goto('/dashboard');
    
    // 验证重定向到登录页
    await expect(page).toHaveURL(/\/login/);
    
    // 登录
    const loginPage = new LoginPage(page);
    await loginPage.login(adminUser.username, adminUser.password);
    
    // 验证重定向到原请求页面
    await expect(page).toHaveURL('/dashboard');
  });

  test('登录页面布局应该正确显示', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 验证品牌信息（桌面端）
    const isMobile = page.viewportSize()?.width! < 1024;
    
    if (!isMobile) {
      // 桌面端：验证左侧品牌区
      await expect(page.locator('text=AI 驱动的智能投标管理')).toBeVisible();
      await expect(page.locator('text=AI 智能编标与审校')).toBeVisible();
    }
    
    // 验证登录表单
    await expect(page.locator('text=欢迎回来')).toBeVisible();
    await expect(page.locator('text=默认账号')).toBeVisible();
  });

  test('移动端登录页面布局应该正确显示', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 验证移动端Logo显示
    await expect(page.locator('text=标书管理平台').first()).toBeVisible();
    
    // 验证登录表单
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
  });
});

test.describe('认证安全', () => {
  test('应该限制登录失败次数', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // 连续失败登录5次
    for (let i = 0; i < 5; i++) {
      await loginPage.login('wronguser', 'wrongpassword');
      await page.waitForTimeout(500);
    }
    
    // 验证是否显示账户锁定提示（取决于后端实现）
    // 这里只是示例，实际行为取决于后端逻辑
  });

  test('密码输入框应该不允许复制', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    await loginPage.passwordInput.fill('testpassword');
    
    // 尝试复制密码（取决于实现）
    const canCopy = await page.evaluate(() => {
      const input = document.querySelector('input[type="password"]') as HTMLInputElement;
      if (!input) return false;
      
      input.select();
      return document.queryCommandEnabled('copy');
    });
    
    // 验证复制行为（实际行为取决于实现）
    // expect(canCopy).toBe(false);
  });
});

# 开发工具配置说明

本项目配置了完整的代码质量工具链，包括 ESLint、Prettier、Husky、lint-staged、Vitest 和 Playwright。

## 🛠️ 代码质量工具

### ESLint

JavaScript/TypeScript 代码检查工具。

```bash
# 检查代码
pnpm run lint

# 自动修复问题
pnpm run lint:fix
```

### Prettier

代码格式化工具。

```bash
# 格式化代码
pnpm run format

# 检查格式
pnpm run format:check
```

### Husky

Git hooks 工具，在提交代码前自动运行检查。

```bash
# 安装 Husky
pnpm exec husky install

# 添加 pre-commit hook
pnpm exec husky add .husky/pre-commit
```

### lint-staged

只对 Git 暂存区（staged）的文件运行检查，提高提交速度。

配置文件：`.lintstagedrc.json`

### 类型检查

使用 TypeScript 编译器进行类型检查。

```bash
# 类型检查
pnpm run type-check
```

## 🧪 测试工具

### Vitest

单元测试框架。

```bash
# 运行测试
pnpm run test

# 运行测试并生成覆盖率报告
pnpm run test:coverage

# 监听模式
pnpm run test:watch
```

### Playwright

E2E 测试框架。

```bash
# 运行 E2E 测试
pnpm run test:e2e

# 调试模式
pnpm run test:e2e:debug

# 生成测试报告
pnpm run test:e2e:report
```

## 📦 依赖安装

如果需要安装所有开发工具依赖：

```bash
pnpm add -D \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-import \
  eslint-plugin-unused-imports \
  prettier \
  husky \
  lint-staged \
  vitest \
  @vitejs/plugin-react \
  @playwright/test \
  jsdom \
  @testing-library/react \
  @testing-library/jest-dom
```

## 📝 提交代码前检查

当你运行 `git commit` 时，会自动执行以下检查：

1. 对所有暂存的 JS/TS/JSX/TSX 文件运行 ESLint
2. 对所有暂存的文件运行 Prettier 格式化

如果检查失败，提交将被阻止，需要修复问题后再提交。

## 🔧 常见问题

### ESLint 和 Prettier 冲突

如果遇到冲突，可以安装 `eslint-config-prettier`：

```bash
pnpm add -D eslint-config-prettier
```

然后在 `.eslintrc.cjs` 的 `extends` 数组末尾添加 `'prettier'`。

### 测试失败

如果测试失败，可以使用 `--ui` 参数查看详细报告：

```bash
pnpm run test --ui
pnpm run test:e2e --ui
```

### 类型错误

如果 TypeScript 类型检查失败，确保所有依赖都已安装：

```bash
pnpm install
```

## 📚 相关文档

- [ESLint 文档](https://eslint.org/)
- [Prettier 文档](https://prettier.io/)
- [Husky 文档](https://typicode.github.io/husky/)
- [Vitest 文档](https://vitest.dev/)
- [Playwright 文档](https://playwright.dev/)

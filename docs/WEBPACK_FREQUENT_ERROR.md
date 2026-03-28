# Webpack 频繁出错原因分析

## 问题现象

最近频繁出现以下错误：

```
TypeError: Cannot read properties of undefined (reading 'call')
    at options.factory (webpack.js:712:31)
```

## 根本原因

### 1. 动态 BuildId 配置（主要原因）

**问题代码**（已修复）：

```typescript
// next.config.ts
generateBuildId: async () => {
  return `build-${Date.now()}`;
},
```

**问题分析**：

1. **每次启动生成新 buildId**：
   - 每次 `pnpm dev` 启动时，`Date.now()` 都会生成不同的时间戳
   - 导致每次 buildId 都不同（如 `build-1774686213586`）

2. **Webpack URL 版本号每次都变**：

   ```
   旧版本：webpack.js?v=1774686207332
   新版本：webpack.js?v=1774686213586
   ```

3. **浏览器缓存失效**：
   - 浏览器请求旧的 URL，但服务器已经没有对应的缓存文件
   - 导致模块加载失败

4. **构建缓存混乱**：
   - `.next` 目录中的缓存文件与新 buildId 不匹配
   - 需要清理缓存才能正常运行

### 2. 频繁重启服务

最近我们进行了以下操作，导致频繁重启：

1. **PM2 配置调整**：
   - 修改了 `ecosystem.config.js`
   - 尝试不同的启动参数
   - 多次停止和重启服务

2. **部署脚本测试**：
   - 创建和测试 `scripts/deploy.sh`
   - 多次执行部署操作

3. **服务保活测试**：
   - 创建和测试 `scripts/keep-alive.sh`
   - 频繁触发服务重启

每次重启都会触发新的 buildId，导致缓存失效。

### 3. 开发环境的特性

- Next.js 开发服务器（`pnpm dev`）会监听文件变化
- 每次文件修改都会触发热更新（HMR）
- 如果 buildId 每次都不同，HMR 可能会失败

## 解决方案

### 1. 移除动态 BuildId（已修复）

**修复后的代码**：

```typescript
// next.config.ts
// 移除 generateBuildId 配置
// 使用 Next.js 默认行为
```

**好处**：

- buildId 在构建时生成，启动时不再变化
- 缓存文件可以正确复用
- HMR 正常工作

### 2. 使用稳定的缓存策略

**当前配置**：

```typescript
async headers() {
  return [
    {
      source: '/_next/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ];
}
```

**说明**：

- 静态资源缓存 1 年
- buildId 不变时，资源可以长期缓存

### 3. 减少不必要的服务重启

**建议**：

- 开发环境使用 `pnpm dev`（支持 HMR）
- 修改代码后等待自动热更新，不要手动重启
- 只在必要时重启服务（如修改配置文件）

## 修复验证

### 修复前

```bash
# 第一次启动
webpack.js?v=1774686207332

# 第二次启动
webpack.js?v=1774686213586  # 版本号变了！

# 结果：模块加载失败
```

### 修复后

```bash
# 第一次启动
webpack.js?v=1774686722898

# 第二次启动（只要不重新构建）
webpack.js?v=1774686722898  # 版本号保持不变

# 结果：模块正常加载
```

## 其他可能的原因

### 1. 构建缓存损坏

**症状**：

- 即使 buildId 不变，仍然出现错误

**解决**：

```bash
rm -rf .next
rm -rf node_modules/.cache
```

### 2. 依赖版本冲突

**症状**：

- 特定模块无法加载

**检查**：

```bash
pnpm list react react-dom next
```

**解决**：

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 3. 内存不足

**症状**：

- 构建时内存溢出

**解决**：

```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev
```

## 预防措施

### 1. 使用合理的 BuildId 生成策略

**开发环境**：

```typescript
// 不配置 generateBuildId，使用默认行为
// 或使用固定的 buildId
generateBuildId: async () => {
  return 'dev-build';
};
```

**生产环境**：

```typescript
// 使用 Git commit hash 或环境变量
generateBuildId: async () => {
  return process.env.BUILD_ID || 'prod-build';
};
```

### 2. 配置服务保活

**使用 keep-alive.sh**：

- 自动监控服务状态
- 失败后自动重启
- 记录详细日志

### 3. 定期清理缓存

**创建定时任务**：

```bash
# scripts/clean-cache.sh
#!/bin/bash
rm -rf .next
echo "构建缓存已清理"
```

**添加到 crontab**：

```bash
# 每天凌晨 3 点清理缓存
0 3 * * * /path/to/scripts/clean-cache.sh
```

### 4. 监控和日志

**健康检查**：

```bash
curl http://localhost:5000/api/health
```

**查看日志**：

```bash
tail -f /app/work/logs/bypass/dev.log
```

## 总结

### 问题根源

- ❌ **主要原因**：`generateBuildId` 使用 `Date.now()`，每次启动都生成新的 buildId
- ❌ **次要原因**：频繁重启服务，导致缓存频繁失效

### 解决方案

- ✅ 移除动态 BuildId 配置
- ✅ 使用 Next.js 默认的 buildId 生成策略
- ✅ 减少不必要的服务重启
- ✅ 配置服务保活机制

### 预期效果

- ✅ buildId 在构建时生成，启动时保持不变
- ✅ 浏览器缓存可以正确复用
- ✅ HMR 正常工作
- ✅ 模块加载错误消失

---

**最后更新**: 2024-03-28
**修复状态**: ✅ 已修复

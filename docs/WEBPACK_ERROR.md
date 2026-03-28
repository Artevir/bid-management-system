# 常见错误：Webpack 模块加载失败

## 错误信息

```
TypeError: Cannot read properties of undefined (reading 'call')
    at options.factory (webpack.js:712:31)
```

## 错误原因

这是一个常见的 Next.js 开发环境错误，通常由以下原因引起：

1. **构建缓存损坏**：`.next` 目录中的缓存文件损坏
2. **模块依赖问题**：`react-dev-inspector` 等开发工具的版本冲突
3. **Next.js 版本不兼容**：依赖包与 Next.js 版本不兼容
4. **模块加载顺序问题**：Webpack 模块加载时的循环依赖

## 解决方案

### 方案一：清理构建缓存（推荐）

```bash
# 1. 停止服务
pkill -f "next dev"

# 2. 清理构建缓存
rm -rf .next
rm -rf node_modules/.cache

# 3. 重启服务
pnpm dev
```

### 方案二：重新安装依赖

```bash
# 1. 停止服务
pkill -f "next dev"

# 2. 删除 node_modules
rm -rf node_modules

# 3. 删除 lock 文件
rm -f pnpm-lock.yaml

# 4. 重新安装依赖
pnpm install

# 5. 重启服务
pnpm dev
```

### 方案三：禁用 react-dev-inspector（临时）

如果问题持续，可以临时禁用 `react-dev-inspector`：

```typescript
// next.config.js
module.exports = {
  // 其他配置...
  experimental: {
    // 禁用开发检查器
    disableOptimizedLoading: true,
  },
};
```

## 预防措施

### 1. 定期清理缓存

```bash
# 创建清理脚本
cat > scripts/clean-cache.sh << 'EOF'
#!/bin/bash
echo "清理构建缓存..."
rm -rf .next
rm -rf node_modules/.cache
echo "清理完成！"
EOF

chmod +x scripts/clean-cache.sh
```

### 2. 使用服务保活脚本

项目已包含 `scripts/keep-alive.sh`，可以自动监控和重启服务：

```bash
# 启动保活脚本
nohup bash scripts/keep-alive.sh > /dev/null 2>&1 &
```

### 3. 监控服务状态

```bash
# 检查服务状态
curl http://localhost:5000/api/health

# 查看日志
tail -f /app/work/logs/bypass/dev.log
```

## 故障排查步骤

1. **检查服务状态**

   ```bash
   curl http://localhost:5000/api/health
   ```

2. **查看错误日志**

   ```bash
   tail -100 /app/work/logs/bypass/console.log
   ```

3. **清理缓存并重启**

   ```bash
   rm -rf .next
   pkill -f "next dev"
   pnpm dev
   ```

4. **如果问题持续，重新安装依赖**
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   pnpm dev
   ```

## 相关资源

- [Next.js 构建优化](https://nextjs.org/docs/building-your-application/optimizing)
- [Webpack 模块加载](https://webpack.js.org/concepts/modules/)
- [Next.js 故障排查](https://nextjs.org/docs/app/building-your-application/troubleshooting)

## 快速修复命令

```bash
# 一键清理并重启
pkill -f "next dev" && rm -rf .next && pnpm dev
```

## 注意事项

1. **开发环境 vs 生产环境**：
   - 此错误通常只在开发环境出现
   - 生产环境使用 `pnpm build && pnpm start` 不会遇到此问题

2. **定期清理**：
   - 建议每周清理一次构建缓存
   - 在遇到奇怪错误时首先尝试清理缓存

3. **版本管理**：
   - 保持依赖包版本一致
   - 使用 pnpm 的锁定文件
   - 定期更新依赖包

## 监控告警

如果服务频繁崩溃，建议：

1. 启用 Sentry 错误监控
2. 配置健康检查告警
3. 使用 PM2 或 systemd 管理进程

---

**最后更新**: 2024-03-28

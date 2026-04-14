# ============================================
# 多阶段构建 Dockerfile
# ============================================

# ============================================
# 阶段 1: 依赖安装
# ============================================
FROM node:24-alpine AS deps

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml* ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# ============================================
# 阶段 2: 构建阶段
# ============================================
FROM node:24-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置构建时环境变量
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# 构建应用
RUN pnpm run build
RUN test -f /app/.next/standalone/server.js

# ============================================
# 阶段 3: 运行阶段
# ============================================
FROM node:24-alpine AS runner

# 安装 pnpm
RUN npm install -g pnpm

# 设置工作目录
WORKDIR /app

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置环境变量
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 更改所有权
RUN chown -R nextjs:nodejs /app

# 切换用户
USER nextjs

# 暴露端口
EXPOSE 5000

# 设置环境变量（在运行时覆盖）
ENV PORT 5000
ENV HOSTNAME "0.0.0.0"

# 启动应用
CMD ["node", "server.js"]

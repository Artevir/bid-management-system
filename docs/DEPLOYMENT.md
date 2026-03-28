# 部署指南

本文档提供投标管理平台的完整部署指南，包括开发环境、预发布环境和生产环境的部署。

## 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [Docker部署](#docker部署)
- [CI/CD配置](#cicd配置)
- [监控和维护](#监控和维护)
- [故障排查](#故障排查)

## 前置要求

### 必需软件

- Node.js 24+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (可选)
- Git

### 系统要求

- CPU: 2核+
- 内存: 4GB+
- 磁盘: 50GB+

## 快速开始

### 1. 克隆代码

```bash
git clone https://github.com/your-org/bid-platform.git
cd bid-platform
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的配置
```

### 3. 安装依赖

```bash
pnpm install
```

### 4. 初始化数据库

```bash
pnpm run db:push
pnpm run db:seed
```

### 5. 启动服务

```bash
pnpm run dev
```

服务将在 http://localhost:5000 启动。

## 开发环境部署

### 使用 Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 运行测试
pnpm run test

# 代码检查
pnpm run lint
pnpm run type-check
```

## 生产环境部署

### 1. 服务器准备

#### 系统更新

```bash
sudo apt update && sudo apt upgrade -y
```

#### 安装必要软件

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 安装 Nginx
sudo apt install nginx -y
```

#### 配置防火墙

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. 部署应用

#### 方式一：使用部署脚本

```bash
# 赋予执行权限
chmod +x scripts/deploy.sh

# 执行部署
./scripts/deploy.sh
```

#### 方式二：手动部署

```bash
# 1. 拉取代码
git clone https://github.com/your-org/bid-platform.git
cd bid-platform

# 2. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 3. 构建镜像
docker-compose build

# 4. 启动服务
docker-compose up -d

# 5. 健康检查
curl http://localhost:5000/api/health
```

### 3. 配置 Nginx

创建 Nginx 配置文件 `/etc/nginx/sites-available/bid-platform`:

```nginx
upstream bid_platform {
    server localhost:5000;
}

server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 代理设置
    location / {
        proxy_pass http://bid_platform;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态文件缓存
    location /static {
        proxy_pass http://bid_platform;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # WebSocket 支持
    location /socket.io/ {
        proxy_pass http://bid_platform;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/bid-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. 配置 SSL 证书（使用 Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Docker 部署

### 构建镜像

```bash
docker build -t bid-platform:latest .
```

### 运行容器

```bash
docker run -d \
  --name bid-platform \
  -p 5000:5000 \
  --env-file .env \
  bid-platform:latest
```

### 使用 Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 重启服务
docker-compose restart app

# 停止所有服务
docker-compose down
```

## CI/CD 配置

### GitHub Actions 配置

CI/CD 流水线配置位于 `.github/workflows/ci-cd.yml`。

#### 配置 Secrets

在 GitHub 仓库设置中配置以下 Secrets：

- `DOCKER_USERNAME`: Docker Hub 用户名
- `DOCKER_PASSWORD`: Docker Hub 密码
- `SERVER_HOST`: 服务器地址
- `SERVER_USER`: 服务器用户名
- `SSH_PRIVATE_KEY`: SSH 私钥
- `DATABASE_URL`: 数据库连接字符串
- `REDIS_PASSWORD`: Redis 密码

#### 触发 CI/CD

- **推送到 main 分支**: 部署到生产环境
- **推送到 develop 分支**: 部署到预发布环境
- **Pull Request**: 仅运行测试和构建

## 监控和维护

### 日志查看

```bash
# Docker 日志
docker-compose logs -f app

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 应用日志
docker-compose exec app tail -f /app/logs/app.log
```

### 数据库备份

```bash
# 备份
docker-compose exec postgres pg_dump -U bid_platform bid_platform > backup.sql

# 恢复
docker-compose exec -T postgres psql -U bid_platform bid_platform < backup.sql
```

### 定期清理

```bash
# 清理 Docker 镜像和容器
docker system prune -a

# 清理旧的日志
find /app/logs -name "*.log" -mtime +30 -delete
```

### 性能监控

访问性能监控面板：

```
http://your-domain.com/api/monitoring/performance
```

## 故障排查

### 服务无法启动

```bash
# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs app

# 检查端口占用
sudo lsof -i :5000
```

### 数据库连接失败

```bash
# 检查数据库状态
docker-compose ps postgres

# 测试数据库连接
docker-compose exec postgres psql -U bid_platform -d bid_platform -c "SELECT 1"
```

### Redis 连接失败

```bash
# 检查 Redis 状态
docker-compose ps redis

# 测试 Redis 连接
docker-compose exec redis redis-cli ping
```

### 内存不足

```bash
# 检查内存使用
free -h

# 清理缓存
docker system prune -a

# 增加 Swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 回滚部署

```bash
# 查看历史版本
git log --oneline

# 回滚到指定版本
git reset --hard <commit-hash>
./scripts/deploy.sh
```

## 附录

### 环境变量参考

详细的环境变量说明请参考 `.env.example` 文件。

### 支持与帮助

如有问题，请：

1. 查看本文档
2. 检查 GitHub Issues
3. 联系技术支持团队

### 版本信息

- 当前版本: v2.0.0
- 更新日期: 2024-01-01

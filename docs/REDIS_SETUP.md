# Redis 配置指南

本文档提供投标管理平台的 Redis 配置指南，用于启用缓存功能。

## 前置要求

1. 已安装 Redis 服务器（版本 7.0+ 推荐）
2. 已安装项目依赖：`pnpm add ioredis`

## 安装 Redis

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install redis-server -y
sudo systemctl start redis
sudo systemctl enable redis
```

### macOS

```bash
brew install redis
brew services start redis
```

### Docker

```bash
docker run -d \
  --name bid-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --requirepass your_secure_password
```

## 配置 Redis

### 1. 创建 Redis 配置文件

创建 `redis.conf` 文件：

```conf
# 绑定地址
bind 0.0.0.0

# 端口
port 6379

# 设置密码
requirepass your_secure_password

# 最大内存设置
maxmemory 1gb

# 内存淘汰策略
maxmemory-policy allkeys-lru

# 持久化
save 900 1
save 300 10
save 60 10000

# 日志级别
loglevel notice

# 数据库数量
databases 16

# 超时设置
timeout 300

# TCP keepalive
tcp-keepalive 300
```

### 2. 启动 Redis（使用配置文件）

```bash
redis-server redis.conf
```

### 3. 验证 Redis 运行

```bash
redis-cli -a your_secure_password ping
# 输出：PONG
```

## 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
REDIS_DB=0
```

### Docker Compose 配置

如果使用 Docker Compose，在 `docker-compose.yml` 中已经包含了 Redis 服务：

```yaml
redis:
  image: redis:7-alpine
  container_name: bid-platform-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
  volumes:
    - redis_data:/data
  networks:
    - bid-platform-network
```

## 使用 Redis 缓存

### 1. 在代码中启用 Redis

编辑 `src/lib/cache/redis-client.ts`，取消注释 Redis 导入：

```typescript
import { Redis } from 'ioredis';
```

### 2. 测试 Redis 连接

创建测试脚本 `scripts/test-redis.js`：

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
});

async function testRedis() {
  try {
    await redis.set('test', 'Hello Redis!');
    const value = await redis.get('test');
    console.log('Redis Test:', value);
    await redis.del('test');
    console.log('Redis connection test passed!');
    process.exit(0);
  } catch (error) {
    console.error('Redis test failed:', error);
    process.exit(1);
  }
}

testRedis();
```

运行测试：

```bash
node scripts/test-redis.js
```

### 3. 应用缓存策略

在业务代码中使用缓存：

```typescript
import { cacheGet, cacheSet } from '@/lib/cache/redis-client';

// 获取缓存
const data = await cacheGet<DataType>('cache:key');
if (data) {
  return data;
}

// 计算数据
const result = await computeExpensiveOperation();

// 设置缓存（1小时过期）
await cacheSet('cache:key', result, { ttl: 3600 });

return result;
```

## Redis 缓存键命名规范

使用以下命名规范：

```
bid-platform:{module}:{resource}:{id}

示例：
- bid-platform:project:123
- bid-platform:company:456:users
- bid-platform:document:789:metadata
```

## 缓存失效策略

### 自动失效

```typescript
import { invalidateProjectCache } from '@/lib/cache/redis-client';

// 项目更新后失效相关缓存
await invalidateProjectCache(projectId);
```

### 手动失效

```typescript
await cacheDelete('cache:key');
await cacheDeletePattern('cache:*');
```

## 监控 Redis

### 使用 Redis CLI

```bash
# 连接到 Redis
redis-cli -a your_secure_password

# 查看信息
INFO

# 查看键数量
DBSIZE

# 查看慢查询
SLOWLOG GET 10

# 查看内存使用
INFO memory
```

### 使用 Redis Insight

Redis Insight 是官方的可视化监控工具：

```bash
docker run -d \
  --name redis-insight \
  -p 8001:8001 \
  redislabs/redisinsight:latest
```

访问 `http://localhost:8001`

## 性能优化

### 1. 启用压缩

```typescript
import { gzip, ungzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const ungzipAsync = promisify(ungzip);

// 压缩存储
async function setCompressed(key: string, value: any) {
  const compressed = await gzipAsync(JSON.stringify(value));
  await redis.set(key, compressed);
}

// 解压读取
async function getCompressed<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  const decompressed = await ungzipAsync(data);
  return JSON.parse(decompressed.toString());
}
```

### 2. 使用 Pipeline

```typescript
const pipeline = redis.pipeline();

pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.set('key3', 'value3');

await pipeline.exec();
```

### 3. 设置合理的 TTL

- 热点数据：5分钟
- 常用数据：30分钟
- 相对稳定数据：1小时
- 很少变化数据：24小时

## 故障排查

### 连接失败

```bash
# 检查 Redis 是否运行
redis-cli -a your_secure_password ping

# 检查端口是否被占用
netstat -an | grep 6379

# 检查防火墙
sudo ufw allow 6379
```

### 内存不足

```bash
# 查看内存使用
redis-cli -a your_secure_password INFO memory

# 清理过期键
redis-cli -a your_secure_password --scan --pattern "bid-platform:*" | xargs redis-cli -a your_secure_password DEL
```

### 性能问题

```bash
# 查看慢查询日志
redis-cli -a your_secure_password SLOWLOG GET 10

# 监控实时命令
redis-cli -a your_secure_password MONITOR
```

## 安全建议

1. **使用强密码**: 至少16位，包含大小写字母、数字和特殊字符
2. **限制网络访问**: 只允许特定IP访问
3. **定期备份**: 启用 RDB 和 AOF 持久化
4. **更新版本**: 定期更新到最新稳定版本
5. **监控日志**: 定期检查 Redis 日志文件

## 参考资料

- [Redis 官方文档](https://redis.io/documentation)
- [ioredis 文档](https://github.com/luin/ioredis)
- [Redis 性能优化](https://redis.io/topics/admin)

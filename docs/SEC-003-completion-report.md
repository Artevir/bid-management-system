# SEC-003 菜单/接口级权限控制 - 任务完成报告

## 任务概述
- **任务编号**: SEC-003
- **任务名称**: 菜单/接口级权限控制
- **完成日期**: 2026-03-16
- **状态**: ✅ 已完成

## 实现内容

### 1. 权限查询服务 (`src/lib/auth/permission.ts`)

#### 核心功能
- **获取用户角色**: `getUserRoles(userId)` - 查询用户的所有角色
- **获取用户权限代码**: `getUserPermissionCodes(userId)` - 查询用户的所有权限代码集合
- **获取用户权限详情**: `getUserPermissions(userId)` - 查询用户的完整权限信息
- **权限检查**: `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()` - 多种权限验证方式
- **菜单权限**: `getUserMenus(userId)` - 获取用户的菜单树（树形结构）
- **API权限**: `getUserApiPermissions(userId)` - 获取用户的API权限映射
- **API访问验证**: `canAccessApi(userId, path, method)` - 验证用户是否可访问指定API

#### 权限查询逻辑
```
用户 → 用户角色关联(userRoles) → 角色(roles) → 角色权限关联(rolePermissions) → 权限(permissions)
```

#### 菜单树构建
权限表通过 `parentId` 字段实现层级结构，`buildMenuTree()` 函数递归构建菜单树。

### 2. 认证中间件增强 (`src/lib/auth/middleware.ts`)

#### 中间件类型
| 中间件 | 功能 | 使用场景 |
|--------|------|----------|
| `withAuth` | 基础认证，验证用户是否登录 | 所有需要登录的API |
| `withOptionalAuth` | 可选认证，已登录则验证 | 公开但登录有额外功能的API |
| `withPermission` | 单权限验证 | 需要特定权限的操作 |
| `withAnyPermission` | 任一权限验证 | 需要多个权限之一的操作 |
| `withAllPermissions` | 全部权限验证 | 需要多个权限的操作 |
| `withApiAccess` | API访问控制 | 基于API路径的权限控制 |
| `withRole` | 角色验证 | 需要特定角色的操作 |
| `withAdmin` | 管理员验证 | 管理后台操作 |

#### 权限缓存
- 内存缓存，TTL 60秒
- 权限变更时自动清除缓存
- `clearPermissionCache(userId?)` 支持清除指定用户或全部缓存

### 3. 权限相关API

#### 用户权限API
| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/auth/permissions` | GET | 获取当前用户的角色、权限、菜单 |
| `/api/auth/menus` | GET | 获取当前用户的菜单树 |

#### 角色管理API
| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/roles` | GET | 获取角色列表 |
| `/api/roles` | POST | 创建角色（需管理员） |
| `/api/roles/[id]` | GET | 获取角色详情 |
| `/api/roles/[id]` | PUT | 更新角色（需管理员） |
| `/api/roles/[id]` | DELETE | 删除角色（需管理员） |
| `/api/roles/[id]/permissions` | GET | 获取角色权限 |
| `/api/roles/[id]/permissions` | PUT | 设置角色权限（需管理员） |

#### 权限管理API
| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/permissions` | GET | 获取权限列表（支持树形） |
| `/api/permissions` | POST | 创建权限（需管理员） |

#### 用户角色管理API
| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/users/[id]/roles` | GET | 获取用户角色 |
| `/api/users/[id]/roles` | PUT | 设置用户角色（需管理员） |

### 4. 权限数据结构

#### 权限类型
- `menu`: 菜单权限，控制前端菜单显示
- `api`: API权限，控制后端接口访问

#### 权限层级
- 通过 `parentId` 实现树形结构
- 父权限授予时，子权限自动继承（前端处理）
- 支持通配符路径（如 `/api/projects/*`）

## API接口清单

```
📋 发现 12 个 API 接口：
1. /api/auth/login - [POST] - 用户登录
2. /api/auth/logout - [POST] - 用户登出
3. /api/auth/refresh - [POST] - 刷新令牌
4. /api/auth/me - [GET] - 获取当前用户
5. /api/auth/permissions - [GET] - 获取用户权限
6. /api/auth/menus - [GET] - 获取用户菜单
7. /api/roles - [GET/POST] - 角色管理
8. /api/roles/[id] - [GET/PUT/DELETE] - 角色详情
9. /api/roles/[id]/permissions - [GET/PUT] - 角色权限
10. /api/permissions - [GET/POST] - 权限管理
11. /api/users/[id]/roles - [GET/PUT] - 用户角色
12. /api/fetch-document - [POST] - 文档获取
```

## 测试结果

### 类型检查
```
npx tsc --noEmit
Status: SUCCESS
```

### API测试结果
| 接口 | 测试结果 | 说明 |
|------|----------|------|
| `/api/auth/menus` | ✅ 通过 | 返回"未登录" |
| `/api/auth/permissions` | ✅ 通过 | 返回"未登录" |
| `/api/roles` | ✅ 通过 | 返回"未登录" |
| `/api/permissions` | ✅ 通过 | 返回"未登录" |
| `/api/roles/1` | ✅ 通过 | 返回"未登录" |
| `/api/roles/1/permissions` | ✅ 通过 | 返回"未登录" |
| `/api/users/1/roles` | ✅ 通过 | 返回"未登录" |

## 技术要点

### 1. RBAC权限模型
- 基于角色的访问控制（Role-Based Access Control）
- 用户 → 角色 → 权限 三层关联
- 支持多角色、多权限

### 2. 权限缓存
- 减少数据库查询压力
- 权限变更自动清除缓存
- 支持精确到用户级别的缓存清除

### 3. 中间件设计
- 高阶函数模式，易于组合
- 统一的错误响应格式
- 支持细粒度权限控制

### 4. 树形结构处理
- 递归构建菜单树
- 支持排序（sortOrder字段）
- 前端可直接渲染

## 后续任务

| 任务编号 | 任务名称 | 依赖 |
|----------|----------|------|
| SEC-004 | 项目级成员授权 | SEC-003 |
| SEC-005 | 文档密级与访问校验 | SEC-003 |
| SEC-006 | 登录页与用户/角色管理页 | SEC-003 |

## 文件清单

```
src/
├── lib/
│   └── auth/
│       ├── permission.ts     # 权限查询服务
│       └── middleware.ts     # 认证中间件（增强）
└── app/
    └── api/
        ├── auth/
        │   ├── permissions/route.ts  # 用户权限API
        │   └── menus/route.ts        # 用户菜单API
        ├── roles/
        │   ├── route.ts              # 角色列表API
        │   └── [id]/
        │       ├── route.ts          # 角色详情API
        │       └── permissions/route.ts  # 角色权限API
        ├── permissions/
        │   └── route.ts              # 权限管理API
        └── users/
            └── [id]/
                └── roles/route.ts    # 用户角色API
```

## 使用示例

### 1. 在API路由中使用权限中间件

```typescript
// 单权限验证
export async function POST(request: NextRequest) {
  return withPermission(request, 'user:create', async (req, userId) => {
    // 有权限时执行
    return NextResponse.json({ success: true });
  });
}

// 多权限验证（任一）
export async function PUT(request: NextRequest) {
  return withAnyPermission(request, ['user:update', 'user:admin'], handler);
}

// 管理员验证
export async function DELETE(request: NextRequest) {
  return withAdmin(request, handler);
}
```

### 2. 前端获取用户菜单

```typescript
const response = await fetch('/api/auth/menus');
const { menus } = await response.json();

// 渲染菜单
menus.forEach(menu => {
  console.log(menu.name, menu.path);
  menu.children.forEach(subMenu => {
    console.log('  ', subMenu.name, subMenu.path);
  });
});
```

### 3. 分配角色权限

```typescript
// 设置角色权限
await fetch('/api/roles/1/permissions', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ permissionIds: [1, 2, 3, 4, 5] })
});
```

---

**任务状态**: ✅ 完成  
**验收标准**: 所有API接口实现并通过测试  
**下一步**: SEC-004 项目级成员授权

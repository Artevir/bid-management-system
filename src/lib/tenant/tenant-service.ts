/**
 * 多租户支持服务
 * 实现多租户隔离、租户上下文管理、数据隔离等功能
 */

// ============================================
// 租户类型
// ============================================

export enum TenantType {
  ENTERPRISE = 'enterprise',
  AGENCY = 'agency',
  FREELANCE = 'freelance',
}

// ============================================
// 租户状态
// ============================================

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  TERMINATED = 'terminated',
}

// ============================================
// 租户配置
// ============================================

export interface TenantConfig {
  maxUsers: number;
  maxProjects: number;
  maxStorage: number; // bytes
  features: {
    aiRecommendations: boolean;
    advancedAnalytics: boolean;
    customTemplates: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
  limits: {
    apiRateLimit: number; // requests per minute
    fileUploadSize: number; // bytes
    concurrentProjects: number;
  };
}

// ============================================
// 租户信息
// ============================================

export interface Tenant {
  id: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  config: TenantConfig;
  domain?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 租户上下文
// ============================================

interface TenantContext {
  tenantId: string;
  tenant?: Tenant;
  userId?: string;
  requestId?: string;
}

// ============================================
// 租户存储
// ============================================

class TenantStore {
  private tenants = new Map<string, Tenant>();
  private context = new Map<string, TenantContext>();

  /**
   * 添加租户
   */
  addTenant(tenant: Tenant): void {
    this.tenants.set(tenant.id, tenant);
  }

  /**
   * 获取租户
   */
  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  /**
   * 更新租户
   */
  updateTenant(tenantId: string, updates: Partial<Tenant>): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return false;

    const updated = { ...tenant, ...updates, updatedAt: new Date() };
    this.tenants.set(tenantId, updated);
    return true;
  }

  /**
   * 删除租户
   */
  deleteTenant(tenantId: string): boolean {
    return this.tenants.delete(tenantId);
  }

  /**
   * 设置上下文
   */
  setContext(requestId: string, context: TenantContext): void {
    this.context.set(requestId, context);
  }

  /**
   * 获取上下文
   */
  getContext(requestId: string): TenantContext | undefined {
    return this.context.get(requestId);
  }

  /**
   * 清除上下文
   */
  clearContext(requestId: string): void {
    this.context.delete(requestId);
  }

  /**
   * 根据域名获取租户
   */
  getTenantByDomain(domain: string): Tenant | undefined {
    for (const tenant of this.tenants.values()) {
      if (tenant.domain === domain) {
        return tenant;
      }
    }
    return undefined;
  }

  /**
   * 获取所有租户
   */
  getAllTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }
}

const tenantStore = new TenantStore();

// ============================================
// 租户管理服务
// ============================================

export class TenantService {
  /**
   * 创建租户
   */
  async createTenant(
    name: string,
    type: TenantType,
    domain?: string
  ): Promise<Tenant> {
    const tenant: Tenant = {
      id: this.generateTenantId(),
      name,
      type,
      status: TenantStatus.PENDING,
      config: this.getDefaultConfig(type),
      domain,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tenantStore.addTenant(tenant);

    // 在实际应用中，这里应该将租户信息保存到数据库
    await this.saveTenantToDatabase(tenant);

    return tenant;
  }

  /**
   * 获取租户
   */
  getTenant(tenantId: string): Tenant | undefined {
    return tenantStore.getTenant(tenantId);
  }

  /**
   * 根据域名获取租户
   */
  getTenantByDomain(domain: string): Tenant | undefined {
    return tenantStore.getTenantByDomain(domain);
  }

  /**
   * 更新租户配置
   */
  updateTenantConfig(tenantId: string, config: Partial<TenantConfig>): boolean {
    const tenant = tenantStore.getTenant(tenantId);
    if (!tenant) return false;

    const updatedConfig = { ...tenant.config, ...config };
    return tenantStore.updateTenant(tenantId, { config: updatedConfig });
  }

  /**
   * 激活租户
   */
  activateTenant(tenantId: string): boolean {
    return tenantStore.updateTenant(tenantId, { status: TenantStatus.ACTIVE });
  }

  /**
   * 暂停租户
   */
  suspendTenant(tenantId: string): boolean {
    return tenantStore.updateTenant(tenantId, { status: TenantStatus.SUSPENDED });
  }

  /**
   * 验证租户访问权限
   */
  validateTenantAccess(tenantId: string): boolean {
    const tenant = tenantStore.getTenant(tenantId);
    if (!tenant) return false;
    return tenant.status === TenantStatus.ACTIVE;
  }

  /**
   * 检查配额
   */
  checkQuota(tenantId: string, quotaType: 'users' | 'projects' | 'storage'): boolean {
    const tenant = tenantStore.getTenant(tenantId);
    if (!tenant) return false;

    switch (quotaType) {
      case 'users':
        // 在实际应用中，需要查询数据库获取当前用户数
        return true;
      case 'projects':
        // 在实际应用中，需要查询数据库获取当前项目数
        return true;
      case 'storage':
        // 在实际应用中，需要查询数据库获取当前存储使用量
        return true;
      default:
        return false;
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  private generateTenantId(): string {
    return `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultConfig(type: TenantType): TenantConfig {
    const baseConfig: TenantConfig = {
      maxUsers: 10,
      maxProjects: 50,
      maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
      features: {
        aiRecommendations: false,
        advancedAnalytics: false,
        customTemplates: false,
        apiAccess: false,
        prioritySupport: false,
      },
      limits: {
        apiRateLimit: 100,
        fileUploadSize: 100 * 1024 * 1024, // 100MB
        concurrentProjects: 5,
      },
    };

    switch (type) {
      case TenantType.ENTERPRISE:
        return {
          ...baseConfig,
          maxUsers: 100,
          maxProjects: 500,
          maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
          features: {
            aiRecommendations: true,
            advancedAnalytics: true,
            customTemplates: true,
            apiAccess: true,
            prioritySupport: true,
          },
          limits: {
            apiRateLimit: 1000,
            fileUploadSize: 1024 * 1024 * 1024, // 1GB
            concurrentProjects: 50,
          },
        };

      case TenantType.AGENCY:
        return {
          ...baseConfig,
          maxUsers: 50,
          maxProjects: 200,
          maxStorage: 50 * 1024 * 1024 * 1024, // 50GB
          features: {
            aiRecommendations: true,
            advancedAnalytics: true,
            customTemplates: true,
            apiAccess: true,
            prioritySupport: false,
          },
          limits: {
            apiRateLimit: 500,
            fileUploadSize: 500 * 1024 * 1024, // 500MB
            concurrentProjects: 20,
          },
        };

      case TenantType.FREELANCE:
        return baseConfig;

      default:
        return baseConfig;
    }
  }

  private async saveTenantToDatabase(tenant: Tenant): Promise<void> {
    // 在实际应用中，这里应该将租户信息保存到数据库
    console.log('Saving tenant to database:', tenant);
  }
}

// ============================================
// 租户中间件
// ============================================

export function createTenantMiddleware() {
  return function tenantMiddleware(request: Request): { tenantId: string } | null {
    // 1. 从请求头获取租户ID
    const headers = request.headers as any;
    const tenantIdFromHeader = headers.get('x-tenant-id');

    if (tenantIdFromHeader) {
      return { tenantId: tenantIdFromHeader };
    }

    // 2. 从子域名获取租户
    const host = headers.get('host') || '';
    const subdomain = host.split('.')[0];

    const tenant = tenantStore.getTenantByDomain(subdomain);
    if (tenant) {
      return { tenantId: tenant.id };
    }

    // 3. 从查询参数获取租户ID（开发环境）
    const url = new URL(request.url);
    const tenantIdFromQuery = url.searchParams.get('tenantId');

    if (tenantIdFromQuery) {
      return { tenantId: tenantIdFromQuery };
    }

    return null;
  };
}

// ============================================
// 租户数据隔离
// ============================================

export function withTenantFilter<T extends Record<string, any>>(
  query: T,
  tenantId: string
): T & { tenantId: string } {
  return {
    ...query,
    tenantId,
  };
}

export function validateTenantAccess<T extends { tenantId?: string }>(
  resource: T,
  requestTenantId: string
): boolean {
  if (!resource.tenantId) {
    return false;
  }
  return resource.tenantId === requestTenantId;
}

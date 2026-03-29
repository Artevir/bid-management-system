/**
 * API版本控制中间件
 * 支持API版本管理（v1, v2等）
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// 版本类型
// ============================================

export type ApiVersion = 'v1' | 'v2' | 'latest';

// ============================================
// 版本配置
// ============================================

export const API_VERSIONS: ApiVersion[] = ['v1', 'v2', 'latest'];

export const LATEST_VERSION: ApiVersion = 'v2';

export const DEPRECATED_VERSIONS: Record<ApiVersion, {
  deprecatedAt?: Date;
  sunsetAt?: Date;
  alternativeVersion: ApiVersion;
  message: string;
}> = {
  v1: {
    deprecatedAt: new Date('2024-01-01'),
    sunsetAt: new Date('2024-12-31'),
    alternativeVersion: 'v2',
    message: 'v1 API已弃用，请迁移到v2 API',
  },
  v2: {
    alternativeVersion: 'v3' as ApiVersion,
    message: '',
  },
  latest: {
    alternativeVersion: 'v3' as ApiVersion,
    message: '',
  },
};

// ============================================
// 版本信息
// ============================================

export interface ApiVersionInfo {
  version: ApiVersion;
  isLatest: boolean;
  isDeprecated: boolean;
  deprecatedAt?: Date;
  sunsetAt?: Date;
  alternativeVersion?: ApiVersion;
  deprecationMessage?: string;
}

// ============================================
// 获取API版本
// ============================================

export function getApiVersion(request: NextRequest): ApiVersion {
  // 1. 从请求头获取版本
  const headerVersion = request.headers.get('X-API-Version') as ApiVersion;
  if (headerVersion && API_VERSIONS.includes(headerVersion)) {
    return headerVersion;
  }

  // 2. 从URL路径获取版本
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const pathVersion = pathSegments[1] as ApiVersion;
  if (pathVersion && API_VERSIONS.includes(pathVersion)) {
    return pathVersion;
  }

  // 3. 从查询参数获取版本
  const queryVersion = url.searchParams.get('version') as ApiVersion;
  if (queryVersion && API_VERSIONS.includes(queryVersion)) {
    return queryVersion;
  }

  // 4. 返回最新版本
  return LATEST_VERSION;
}

// ============================================
// 获取版本信息
// ============================================

export function getVersionInfo(version: ApiVersion): ApiVersionInfo {
  const deprecationInfo = DEPRECATED_VERSIONS[version];

  return {
    version,
    isLatest: version === LATEST_VERSION,
    isDeprecated: !!deprecationInfo.deprecatedAt,
    deprecatedAt: deprecationInfo.deprecatedAt,
    sunsetAt: deprecationInfo.sunsetAt,
    alternativeVersion: deprecationInfo.alternativeVersion,
    deprecationMessage: deprecationInfo.message,
  };
}

// ============================================
// 版本响应头
// ============================================

export function setVersionHeaders(response: NextResponse, version: ApiVersion): void {
  const versionInfo = getVersionInfo(version);

  response.headers.set('API-Version', version);
  response.headers.set('API-Latest-Version', LATEST_VERSION);

  if (versionInfo.isDeprecated) {
    response.headers.set('Deprecation', 'true');
    response.headers.set('Sunset', versionInfo.sunsetAt?.toISOString() || '');
    response.headers.set(
      'Link',
      `<${versionInfo.alternativeVersion}>; rel="successor-version"; title="${versionInfo.deprecationMessage}"`
    );
  }
}

// ============================================
// 版本中间件
// ============================================

export interface VersionMiddlewareOptions {
  supportedVersions?: ApiVersion[];
  requireVersion?: boolean;
  defaultVersion?: ApiVersion;
}

export function withVersionMiddleware(
  options: VersionMiddlewareOptions = {}
) {
  const {
    supportedVersions = API_VERSIONS,
    requireVersion = false,
    _defaultVersion = LATEST_VERSION,
  } = options;

  return async function versionMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    const version = getApiVersion(request);

    // 检查版本是否支持
    if (requireVersion && !supportedVersions.includes(version)) {
      return NextResponse.json(
        {
          error: '不支持的API版本',
          requestedVersion: version,
          supportedVersions,
          latestVersion: LATEST_VERSION,
        },
        { status: 400 }
      );
    }

    // 设置版本信息到请求头（用于后续处理）
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('X-API-Version-Resolved', version);

    return null;
  };
}

// ============================================
// 版本检查工具
// ============================================

export function checkVersionCompatibility(
  requestVersion: ApiVersion,
  requiredVersion?: ApiVersion
): { compatible: boolean; reason?: string } {
  const versionInfo = getVersionInfo(requestVersion);

  // 检查是否已弃用
  if (versionInfo.isDeprecated) {
    return {
      compatible: true,
      reason: `版本${requestVersion}已弃用，将在${versionInfo.sunsetAt?.toISOString()}后停止支持`,
    };
  }

  // 检查是否满足最低版本要求
  if (requiredVersion && !isVersionGte(requestVersion, requiredVersion)) {
    return {
      compatible: false,
      reason: `需要API版本${requiredVersion}或更高`,
    };
  }

  return { compatible: true };
}

// ============================================
// 版本比较工具
// ============================================

function isVersionGte(version: ApiVersion, minVersion: ApiVersion): boolean {
  const versions = API_VERSIONS;
  const versionIndex = versions.indexOf(version);
  const minVersionIndex = versions.indexOf(minVersion);

  return versionIndex >= minVersionIndex;
}

// ============================================
// 版本路由助手
// ============================================

export function createVersionedPath(path: string, version: ApiVersion): string {
  // 移除开头的斜杠
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // 如果路径已经包含版本，则替换
  const segments = cleanPath.split('/').filter(Boolean);
  if (API_VERSIONS.includes(segments[0] as ApiVersion)) {
    segments[0] = version;
  } else {
    segments.unshift(version);
  }

  return '/' + segments.join('/');
}

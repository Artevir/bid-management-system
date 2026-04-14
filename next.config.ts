import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 与 Dockerfile 的 `.next/standalone` 产物保持一致，避免运行时产物不完整。
  output: 'standalone',

  // Avoid bundling this SDK into server chunks in ways that break runtime (e.g. class extends undefined).
  serverExternalPackages: ['coze-coding-dev-sdk'],

  // ESLint配置
  eslint: {
    // 构建时忽略ESLint错误
    ignoreDuringBuilds: true,
  },

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
        pathname: '/**',
      },
    ],
  },

  // 实验性功能
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // 编译优化
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error', 'warn'],
          }
        : false,
  },

  // 压缩配置
  compress: true,

  // 生产环境source map
  productionBrowserSourceMaps: false,

  // 严格模式
  reactStrictMode: true,

  // 移除动态 buildId，使用 Next.js 默认行为
  // 注意：动态 buildId 会导致每次启动都重新构建，影响开发和部署效率

  // Headers 配置 - 禁用 HTML 页面缓存
  async headers() {
    return [
      // 具体路径放前：避免与下方 `/:path*` 在合并策略上产生歧义；带 hash 的 chunk 可长期缓存
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // 静态资源缓存
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },

  // 日志配置
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;

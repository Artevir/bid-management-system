/**
 * API v2 主路由
 * v2版本作为最新稳定版本
 */

import { NextRequest, NextResponse } from 'next/server';
import { LATEST_VERSION, getVersionInfo, setVersionHeaders } from '@/lib/api/version-control';

// ============================================
// 版本信息端点
// ============================================

export async function GET(request: NextRequest) {
  const versionInfo = getVersionInfo(LATEST_VERSION);

  const response = NextResponse.json({
    version: LATEST_VERSION,
    status: versionInfo.isDeprecated ? 'deprecated' : 'stable',
    description: '投标管理平台API v2 - 最新稳定版本',
    features: [
      '增强的项目管理功能',
      '改进的文件上传支持',
      '优化的性能表现',
      '增强的错误处理',
      '更详细的API文档',
    ],
    changes: {
      breaking: [
        '/api/v1/projects/:id/members 现在返回简化的成员列表',
        '文档上传接口现在支持分片上传',
      ],
      added: [
        '新增项目模板功能',
        '新增批量操作接口',
        '新增文件版本管理',
      ],
      deprecated: [
        'GET /api/v1/projects/summary 将在v3中移除',
      ],
    },
    documentation: `${process.env.COZE_PROJECT_DOMAIN_DEFAULT}/api-docs?version=v2`,
  });

  setVersionHeaders(response, LATEST_VERSION);
  return response;
}

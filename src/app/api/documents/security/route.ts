/**
 * 文档密级管理API
 * GET: 获取密级选项
 * POST: 检查文档访问权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  canAccessDocument,
  getUserMaxSecurityLevel,
  getCreatableSecurityLevels,
  getAllSecurityLevels,
  isValidSecurityLevel,
  SecurityLevel,
} from '@/lib/document/security';

// 获取密级选项或检查访问权限
async function handleRequest(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 获取所有密级选项
    if (action === 'list') {
      return NextResponse.json({
        levels: getAllSecurityLevels(),
      });
    }

    // 获取用户在项目中的最高密级
    if (action === 'user-level') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      if (!projectId) {
        return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
      }

      const level = await getUserMaxSecurityLevel(projectId, userId);
      return NextResponse.json({
        projectId,
        maxSecurityLevel: level,
      });
    }

    // 获取用户可创建的密级
    if (action === 'creatable') {
      const projectId = parseInt(searchParams.get('projectId') || '0');
      if (!projectId) {
        return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
      }

      const levels = await getCreatableSecurityLevels(projectId, userId);
      return NextResponse.json({
        projectId,
        creatableLevels: levels,
      });
    }

    // 默认返回所有密级选项
    return NextResponse.json({
      levels: getAllSecurityLevels(),
    });
  } catch (error) {
    console.error('Handle security level error:', error);
    return NextResponse.json({ error: '处理请求失败' }, { status: 500 });
  }
}

// 检查文档访问权限
async function checkAccess(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { projectId, documentLevel, documents } = body;

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    // 检查单个文档
    if (documentLevel) {
      if (!isValidSecurityLevel(documentLevel)) {
        return NextResponse.json({ error: '无效的密级' }, { status: 400 });
      }

      const canAccess = await canAccessDocument(projectId, userId, documentLevel);
      return NextResponse.json({
        projectId,
        documentLevel,
        canAccess,
      });
    }

    // 批量检查多个文档
    if (documents && Array.isArray(documents)) {
      const results = await Promise.all(
        documents.map(async (doc: { id: number; securityLevel: SecurityLevel }) => {
          const canAccess = await canAccessDocument(projectId, userId, doc.securityLevel);
          return { id: doc.id, canAccess };
        })
      );

      return NextResponse.json({
        projectId,
        results,
      });
    }

    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('Check document access error:', error);
    return NextResponse.json({ error: '检查访问权限失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, handleRequest);
}

export async function POST(request: NextRequest) {
  return withAuth(request, checkAccess);
}

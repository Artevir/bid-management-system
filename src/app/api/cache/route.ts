/**
 * Redis缓存管理API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  cacheExists,
  cacheTTL,
  getCacheStats,
  invalidateCompanyCache,
  invalidateProjectRedisCache,
  invalidateUserRedisCache,
} from '@/lib/cache';

// ============================================
// GET - 获取缓存信息
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'stats';

  try {
    switch (type) {
      case 'stats':
        const stats = await getCacheStats();
        return NextResponse.json(stats);

      case 'get':
        const key = searchParams.get('key');
        if (!key) {
          return NextResponse.json(
            { error: '缺少key参数' },
            { status: 400 }
          );
        }
        const value = await cacheGet(key);
        const exists = await cacheExists(key);
        const ttl = await cacheTTL(key);
        return NextResponse.json({
          key,
          exists,
          value,
          ttl,
        });

      default:
        return NextResponse.json(
          { error: '无效的类型参数' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Get cache error:', error);
    return NextResponse.json(
      { error: '获取缓存失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 设置缓存
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, ttl } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: '缺少key或value参数' },
        { status: 400 }
      );
    }

    await cacheSet(key, value, { ttl });

    return NextResponse.json({
      success: true,
      key,
      ttl: ttl || 3600,
    });
  } catch (error) {
    console.error('Set cache error:', error);
    return NextResponse.json(
      { error: '设置缓存失败' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 删除缓存
// ============================================

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'key';

  try {
    switch (type) {
      case 'key':
        const key = searchParams.get('key');
        if (!key) {
          return NextResponse.json(
            { error: '缺少key参数' },
            { status: 400 }
          );
        }
        await cacheDelete(key);
        return NextResponse.json({
          success: true,
          message: '缓存已删除',
        });

      case 'pattern':
        const pattern = searchParams.get('pattern');
        if (!pattern) {
          return NextResponse.json(
            { error: '缺少pattern参数' },
            { status: 400 }
          );
        }
        const count = await cacheDeletePattern(pattern);
        return NextResponse.json({
          success: true,
          message: `已删除${count}个缓存`,
          count,
        });

      case 'project':
        const projectId = searchParams.get('projectId');
        if (!projectId) {
          return NextResponse.json(
            { error: '缺少projectId参数' },
            { status: 400 }
          );
        }
        await invalidateProjectRedisCache(projectId);
        return NextResponse.json({
          success: true,
          message: '项目缓存已失效',
        });

      case 'company':
        const companyId = searchParams.get('companyId');
        if (!companyId) {
          return NextResponse.json(
            { error: '缺少companyId参数' },
            { status: 400 }
          );
        }
        await invalidateCompanyCache(companyId);
        return NextResponse.json({
          success: true,
          message: '公司缓存已失效',
        });

      case 'user':
        const userId = searchParams.get('userId');
        if (!userId) {
          return NextResponse.json(
            { error: '缺少userId参数' },
            { status: 400 }
          );
        }
        await invalidateUserRedisCache(userId);
        return NextResponse.json({
          success: true,
          message: '用户缓存已失效',
        });

      default:
        return NextResponse.json(
          { error: '无效的类型参数' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Delete cache error:', error);
    return NextResponse.json(
      { error: '删除缓存失败' },
      { status: 500 }
    );
  }
}

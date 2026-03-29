/**
 * 提示词分类管理API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { promptCategories } from '@/db/schema';
import { eq, like, desc as _desc, asc, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/jwt';

// ============================================
// GET: 获取分类列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const keyword = searchParams.get('keyword');
    const tree = searchParams.get('tree') === 'true';

    const conditions = [eq(promptCategories.isActive, true)];
    
    if (type && type !== 'all') {
      conditions.push(eq(promptCategories.type, type as any));
    }
    
    if (keyword) {
      conditions.push(like(promptCategories.name, `%${keyword}%`));
    }

    const categories = await db
      .select()
      .from(promptCategories)
      .where(and(...conditions))
      .orderBy(asc(promptCategories.sortOrder));

    if (tree) {
      // 构建树形结构
      const buildTree = (items: any[], parentId: number | null = null): any[] => {
        return items
          .filter(item => item.parentId === parentId)
          .map(item => ({
            ...item,
            children: buildTree(items, item.id),
          }));
      };
      
      return NextResponse.json({ items: buildTree(categories) });
    }

    return NextResponse.json({ items: categories });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return NextResponse.json(
      { error: '获取分类列表失败' },
      { status: 500 }
    );
  }
}

// ============================================
// POST: 创建分类
// ============================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, type, description, icon, parentId, sortOrder } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: '缺少必填字段：name, code' },
        { status: 400 }
      );
    }

    // 检查code是否已存在
    const existing = await db
      .select()
      .from(promptCategories)
      .where(eq(promptCategories.code, code))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: '分类编码已存在' },
        { status: 400 }
      );
    }

    const [category] = await db
      .insert(promptCategories)
      .values({
        name,
        code,
        type: type || 'custom',
        description: description || null,
        icon: icon || null,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('创建分类失败:', error);
    return NextResponse.json(
      { error: '创建分类失败' },
      { status: 500 }
    );
  }
}

/**
 * 知识分类API
 * GET: 获取知识分类列表
 * POST: 创建知识分类
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { knowledgeCategories } from '@/db/schema';
import { eq, isNull } from 'drizzle-orm';

// 获取知识分类树
async function getCategoryTree(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    // 获取所有分类
    const categories = await db.select().from(knowledgeCategories);

    // 构建树形结构
    const buildTree = (parentId: number | null = null): any[] => {
      return categories
        .filter((c) =>
          parentId === null ? c.parentId === null : c.parentId === parentId
        )
        .map((category) => ({
          ...category,
          children: buildTree(category.id),
        }));
    };

    const tree = buildTree();

    return NextResponse.json({ categories: tree });
  } catch (error) {
    console.error('Get knowledge categories error:', error);
    return NextResponse.json({ error: '获取知识分类失败' }, { status: 500 });
  }
}

// 创建知识分类
async function createCategory(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, parentId, description, icon } = body;

    if (!name) {
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
    }

    // 检查父分类是否存在
    if (parentId) {
      const parent = await db
        .select()
        .from(knowledgeCategories)
        .where(eq(knowledgeCategories.id, parentId))
        .limit(1);

      if (parent.length === 0) {
        return NextResponse.json({ error: '父分类不存在' }, { status: 404 });
      }
    }

    // 生成分类代码
    const code = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    
    const [category] = await db
      .insert(knowledgeCategories)
      .values({
        name,
        code,
        parentId: parentId || null,
        description: description || null,
        icon: icon || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      category,
      message: '知识分类创建成功',
    });
  } catch (error) {
    console.error('Create knowledge category error:', error);
    return NextResponse.json({ error: '创建知识分类失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => getCategoryTree(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createCategory(req, userId));
}

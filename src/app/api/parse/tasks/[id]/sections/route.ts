/**
 * 解析章节API
 * GET: 获取解析任务的章节列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/db';
import { parseResults } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 获取章节列表
async function getSections(
  request: NextRequest,
  userId: number,
  taskId: number
): Promise<NextResponse> {
  try {
    const results = await db
      .select()
      .from(parseResults)
      .where(eq(parseResults.taskId, taskId))
      .orderBy(parseResults.id);

    // 构建树形结构
    interface SectionNode {
      id: string;
      title: string;
      level: number;
      content: string;
      type: string;
      pageNumber: number | null;
      children: SectionNode[];
    }

    const buildTree = (parentId: number | null = null): SectionNode[] => {
      return results
        .filter((r) => r.id !== undefined)
        .map((result) => ({
          id: result.id.toString(),
          title: result.sectionTitle || '未命名章节',
          level: result.sectionType === 'chapter' ? 1 :
                 result.sectionType === 'section' ? 2 :
                 result.sectionType === 'subsection' ? 3 : 4,
          content: result.content || '',
          type: result.sectionType || 'clause',
          pageNumber: result.pageNumber,
          children: [],
        }));
    };

    const sections = buildTree();

    return NextResponse.json({
      sections,
      total: sections.length,
    });
  } catch (error) {
    console.error('Get sections error:', error);
    return NextResponse.json({ error: '获取章节列表失败' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, (req, userId) => getSections(req, userId, parseInt(id)));
}

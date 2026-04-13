/**
 * 批量图片生成API
 * POST - 批量生成图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { z } from 'zod';

// ============================================
// 请求参数验证
// ============================================

const batchGenerateSchema = z.object({
  prompts: z.array(z.string().min(1)).min(1, '提示词列表不能为空').max(10, '最多一次生成10张图片'),
  type: z.enum(['text_to_image', 'image_to_image', 'batch_generation']).optional(),
  size: z.enum(['2K', '4K', 'custom']).optional(),
  customWidth: z.number().optional(),
  customHeight: z.number().optional(),
  watermark: z.boolean().optional(),
  referenceImages: z.array(z.string()).optional(),
  projectId: z.number().optional(),
  projectName: z.string().optional(),
  bidDocumentId: z.number().optional(),
  businessObjectType: z
    .enum(['project', 'bid_document', 'chapter', 'marketing', 'other'])
    .optional(),
  businessObjectId: z.number().optional(),
  usage: z.string().optional(),
});

// ============================================
// POST - 批量生成图片
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 获取当前用户
    const user = await requireAuth();

    // 解析请求体
    const body = await request.json();
    const validatedData = batchGenerateSchema.parse(body);

    // 批量生成图片
    const { generateBatchImages } = await import('@/lib/image-generation/service');
    const results = await generateBatchImages(
      validatedData.prompts,
      {
        ...validatedData,
        createdBy: user.id,
      },
      Object.fromEntries(request.headers.entries())
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('批量图片生成失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '参数验证失败', details: error.errors }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量图片生成失败' },
      { status: 500 }
    );
  }
}

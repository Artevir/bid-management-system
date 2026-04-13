/**
 * 图片生成API
 * POST - 创建图片生成任务
 * GET - 获取图片生成列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { z } from 'zod';

// ============================================
// 请求参数验证
// ============================================

const generateImageSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空'),
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

const getListSchema = z.object({
  projectId: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .optional(),
  bidDocumentId: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .optional(),
  businessObjectType: z.string().optional(),
  businessObjectId: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .optional(),
  status: z.string().optional(),
  page: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .optional(),
  pageSize: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .optional(),
});

// ============================================
// POST - 创建图片生成任务
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 获取当前用户
    const user = await requireAuth();

    // 解析请求体
    const body = await request.json();
    const validatedData = generateImageSchema.parse(body);

    // 生成图片
    const { generateImage } = await import('@/lib/image-generation/service');
    const result = await generateImage(
      {
        ...validatedData,
        createdBy: user.id,
      },
      Object.fromEntries(request.headers.entries())
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('图片生成失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '参数验证失败', details: error.errors }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片生成失败' },
      { status: 500 }
    );
  }
}

// ============================================
// GET - 获取图片生成列表
// ============================================

export async function GET(request: NextRequest) {
  try {
    // 获取当前用户
    const user = await requireAuth();

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const validatedData = getListSchema.parse(Object.fromEntries(searchParams.entries()));

    // 获取列表
    const { getImageGenerationList } = await import('@/lib/image-generation/service');
    const records = await getImageGenerationList({
      ...validatedData,
      createdBy: user.id,
    });

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error) {
    console.error('获取图片生成列表失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '参数验证失败', details: error.errors }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取图片生成列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 图片生成 API
 * POST: 生成图片
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import type { ImageType, ImageSize, GenerateMode } from '@/lib/image/service';

function extractForwardHeaders(headers: Headers): Record<string, string> {
  const customHeaders: Record<string, string> = {};
  const forwardHeaders = ['authorization', 'x-api-key', 'x-request-id', 'x-session-id', 'cookie'];

  for (const key of forwardHeaders) {
    const value = headers.get(key);
    if (value) {
      customHeaders[key] = value;
    }
  }

  return customHeaders;
}

// POST /api/image/generate
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      imageType,
      generateMode,
      size,
      customWidth,
      customHeight,
      style,
      colorScheme,
      agentId,
      agentName,
      projectId,
      bidId,
    } = body;

    // 验证参数
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 });
    }

    // 提取请求头
    const customHeaders = extractForwardHeaders(request.headers);

    // 调用生成服务
    const { generateImage } = await import('@/lib/image/service');
    const result = await generateImage(
      {
        prompt,
        imageType: imageType as ImageType,
        generateMode: generateMode as GenerateMode,
        size: size as ImageSize,
        customWidth,
        customHeight,
        style,
        colorScheme,
        agentId,
        agentName,
        projectId,
        bidId,
        userId: user.userId,
      },
      customHeaders
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        imageId: result.imageId,
        imageUrl: result.imageUrl,
      });
    } else {
      return NextResponse.json({ error: result.error || '图片生成失败' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('图片生成失败:', error);
    return NextResponse.json({ error: error.message || '图片生成失败' }, { status: 500 });
  }
}

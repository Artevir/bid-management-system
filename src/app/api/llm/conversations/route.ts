/**
 * LLM对话管理 API
 * GET: 获取对话列表或详情
 * POST: 创建对话
 * DELETE: 删除对话
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  createConversation,
  getConversationList,
  getConversationWithMessages,
  deleteConversation,
  addMessage,
  ConversationCreate,
} from '@/lib/llm/service';

// 获取对话列表或详情
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 获取单个对话详情
    if (conversationId) {
      const conversation = await getConversationWithMessages(parseInt(conversationId));
      if (!conversation) {
        return NextResponse.json({ error: '对话不存在' }, { status: 404 });
      }
      return NextResponse.json({ conversation });
    }

    // 获取对话列表
    const conversations = await getConversationList(user.userId, limit);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('获取LLM对话失败:', error);
    return NextResponse.json({ error: '获取对话失败' }, { status: 500 });
  }
}

// 创建对话
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();

    // 添加消息到现有对话
    if (body.conversationId && body.message) {
      const message = await addMessage({
        conversationId: body.conversationId,
        role: body.message.role || 'user',
        content: body.message.content,
        contentType: body.message.contentType,
        mediaUrls: body.message.mediaUrls,
      });
      return NextResponse.json({ success: true, message });
    }

    // 创建新对话
    const data: ConversationCreate = {
      title: body.title,
      configId: body.configId,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
      thinking: body.thinking,
      caching: body.caching,
      createdBy: user.userId,
    };

    const conversation = await createConversation(data);

    return NextResponse.json(
      {
        success: true,
        message: '对话创建成功',
        conversation,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('创建LLM对话失败:', error);
    return NextResponse.json(
      { error: error.message || '创建对话失败' },
      { status: 400 }
    );
  }
}

// 删除对话
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: '缺少对话ID' }, { status: 400 });
    }

    await deleteConversation(parseInt(conversationId));

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error: any) {
    console.error('删除LLM对话失败:', error);
    return NextResponse.json(
      { error: error.message || '删除对话失败' },
      { status: 400 }
    );
  }
}

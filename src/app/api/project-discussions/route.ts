import { NextRequest, NextResponse } from 'next/server';
import {
  getProjectDiscussion,
  createProjectDiscussion,
  getOrCreateProjectDiscussion,
  updateProjectDiscussion,
  getUserDiscussions,
  getMessages,
  sendMessage,
  searchMessages,
} from '@/lib/project-discussion/service';
import { checkProjectPermission } from '@/lib/project-org/service';

// GET /api/project-discussions - 获取用户讨论区列表或讨论区消息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const keyword = searchParams.get('keyword');

    // 获取用户的讨论区列表
    if (action === 'list' && userId) {
      const discussions = await getUserDiscussions(parseInt(userId));
      return NextResponse.json({ data: discussions });
    }

    // 搜索消息
    if (action === 'search' && projectId && keyword) {
      const discussion = await getProjectDiscussion(parseInt(projectId));
      if (!discussion) {
        return NextResponse.json({ error: '讨论区不存在' }, { status: 404 });
      }
      const messages = await searchMessages(discussion.id, keyword, {
        startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
        endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      });
      return NextResponse.json({ data: messages });
    }

    // 获取讨论区消息
    if (projectId) {
      const discussion = await getProjectDiscussion(parseInt(projectId));
      if (!discussion) {
        return NextResponse.json({ data: null, messages: [], total: 0 });
      }

      const { data: messages, total } = await getMessages(discussion.id, { page, pageSize });
      return NextResponse.json({ data: discussion, messages, total });
    }

    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('获取讨论区失败:', error);
    return NextResponse.json({ error: '获取讨论区失败' }, { status: 500 });
  }
}

// POST /api/project-discussions - 创建讨论区或发送消息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    // 创建或获取讨论区
    if (action === 'getOrCreate') {
      const { projectId, userId } = data;
      const discussion = await getOrCreateProjectDiscussion(projectId, userId);
      return NextResponse.json({ data: discussion });
    }

    // 发送消息
    if (action === 'sendMessage') {
      const { discussionId, userId, content, mentions, fileData } = data;

      // 获取用户信息
      const [user] = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/users/${userId}`)
        .then(res => res.json())
        .catch(() => ({ data: null }));

      const message = await sendMessage({
        discussionId,
        authorId: userId,
        authorName: user?.name || '未知用户',
        content,
        mentions: mentions ? JSON.stringify(mentions) : null,
        type: fileData ? 'file' : 'text',
        ...fileData,
      });

      // 如果有文件，也添加到文件表
      if (fileData?.fileId) {
        const { uploadDiscussionFile } = await import('@/lib/project-discussion/service');
        await uploadDiscussionFile({
          discussionId,
          messageId: message.id,
          fileId: fileData.fileId,
          fileName: fileData.fileName,
          fileSize: fileData.fileSize,
          fileType: fileData.fileType,
          uploadedBy: userId,
        });
      }

      return NextResponse.json({ data: message });
    }

    // 创建讨论区
    if (action === 'create') {
      const discussion = await createProjectDiscussion(data);
      return NextResponse.json({ data: discussion });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    console.error('操作失败:', error);
    return NextResponse.json({ error: (error as Error).message || '操作失败' }, { status: 500 });
  }
}

// PUT /api/project-discussions - 更新讨论区设置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { discussionId, data } = body;

    const discussion = await updateProjectDiscussion(discussionId, data);
    return NextResponse.json({ data: discussion });
  } catch (error) {
    console.error('更新讨论区失败:', error);
    return NextResponse.json({ error: '更新讨论区失败' }, { status: 500 });
  }
}

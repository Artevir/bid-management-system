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
  checkDiscussionPermission,
} from '@/lib/project-discussion/service';
import { checkProjectPermission } from '@/lib/project-org/service';
import { withAuth } from '@/lib/auth/middleware';
import { getCurrentUser } from '@/lib/auth/jwt';

function toPositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// GET /api/project-discussions - 获取用户讨论区列表或讨论区消息
export async function GET(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const { searchParams } = new URL(req.url);
      const projectId = toPositiveInt(searchParams.get('projectId'));
      const action = searchParams.get('action');
      const page = Number.parseInt(searchParams.get('page') || '1', 10);
      const pageSize = Number.parseInt(searchParams.get('pageSize') || '50', 10);
      const keyword = searchParams.get('keyword');

      // 获取当前用户的讨论区列表
      if (action === 'list') {
        const discussions = await getUserDiscussions(userId);
        return NextResponse.json({ data: discussions });
      }

      // 搜索消息
      if (action === 'search' && projectId && keyword) {
        const permission = await checkProjectPermission(projectId, userId);
        if (!permission) {
          return NextResponse.json({ error: '无权访问该项目讨论区' }, { status: 403 });
        }
        const discussion = await getProjectDiscussion(projectId);
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
        const permission = await checkProjectPermission(projectId, userId);
        if (!permission) {
          return NextResponse.json({ error: '无权访问该项目讨论区' }, { status: 403 });
        }
        const discussion = await getProjectDiscussion(projectId);
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
  });
}

// POST /api/project-discussions - 创建讨论区或发送消息
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const body = await req.json();
      const { action, data } = body;

      // 创建或获取讨论区
      if (action === 'getOrCreate') {
        const projectId = toPositiveInt(String(data?.projectId ?? ''));
        if (!projectId) {
          return NextResponse.json({ error: '无效的项目ID' }, { status: 400 });
        }

        const permission = await checkProjectPermission(projectId, userId);
        if (!permission) {
          return NextResponse.json({ error: '无权访问该项目讨论区' }, { status: 403 });
        }

        const discussion = await getOrCreateProjectDiscussion(projectId, userId);
        return NextResponse.json({ data: discussion });
      }

      // 发送消息
      if (action === 'sendMessage') {
        const discussionId = toPositiveInt(String(data?.discussionId ?? ''));
        if (!discussionId || !data?.content) {
          return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }

        const permissionCheck = await checkDiscussionPermission(discussionId, userId);
        if (!permissionCheck.canAccess) {
          return NextResponse.json({ error: '无权访问该讨论区' }, { status: 403 });
        }

        const currentUser = await getCurrentUser();
        const authorName = currentUser?.username || `用户${userId}`;
        const { mentions, fileData } = data;

        const message = await sendMessage({
          discussionId,
          authorId: userId,
          authorName,
          content: String(data.content),
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
        const projectId = toPositiveInt(String(data?.projectId ?? ''));
        if (!projectId) {
          return NextResponse.json({ error: '无效的项目ID' }, { status: 400 });
        }
        const permission = await checkProjectPermission(projectId, userId);
        if (!permission || permission === 'level_3') {
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }
        const discussion = await createProjectDiscussion({
          ...data,
          projectId,
          createdBy: userId,
        });
        return NextResponse.json({ data: discussion });
      }

      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    } catch (error) {
      console.error('操作失败:', error);
      return NextResponse.json({ error: (error as Error).message || '操作失败' }, { status: 500 });
    }
  });
}

// PUT /api/project-discussions - 更新讨论区设置
export async function PUT(request: NextRequest) {
  return withAuth(request, async (req, userId) => {
    try {
      const body = await req.json();
      const discussionId = toPositiveInt(String(body?.discussionId ?? ''));
      const data = body?.data;
      if (!discussionId || !data) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      const permissionCheck = await checkDiscussionPermission(discussionId, userId);
      if (!permissionCheck.canAccess || permissionCheck.permissionLevel === 'level_3') {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }

      const discussion = await updateProjectDiscussion(discussionId, data);
      return NextResponse.json({ data: discussion });
    } catch (error) {
      console.error('更新讨论区失败:', error);
      return NextResponse.json({ error: '更新讨论区失败' }, { status: 500 });
    }
  });
}

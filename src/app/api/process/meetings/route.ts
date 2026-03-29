/**
 * 过程记录API - 会议纪要
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getMeetingMinutes,
  createMeetingMinute,
  updateMeetingMinute,
  deleteMeetingMinute,
} from '@/lib/project/process';

async function listMinutes(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const minutes = await getMeetingMinutes(parseInt(projectId));

    return NextResponse.json({
      minutes: minutes.map((m) => ({
        ...m,
        participants: m.participants ? JSON.parse(m.participants) : null,
        attachments: m.attachments ? JSON.parse(m.attachments) : null,
      })),
    });
  } catch (error) {
    console.error('Get meeting minutes error:', error);
    return NextResponse.json({ error: '获取会议纪要失败' }, { status: 500 });
  }
}

async function createMinute(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { projectId, title, content, meetingDate, participants, location, meetingType, attachments } = body;

    if (!projectId || !title || !content || !meetingDate) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const minute = await createMeetingMinute({
      projectId,
      title,
      content,
      meetingDate: new Date(meetingDate),
      participants,
      location,
      meetingType,
      attachments,
      createdBy: userId,
    });

    return NextResponse.json({ success: true, minute });
  } catch (error) {
    console.error('Create meeting minute error:', error);
    return NextResponse.json({ error: '创建会议纪要失败' }, { status: 500 });
  }
}

async function updateMinute(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, ...params } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少纪要ID' }, { status: 400 });
    }

    if (params.meetingDate) {
      params.meetingDate = new Date(params.meetingDate);
    }

    await updateMeetingMinute(id, params);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update meeting minute error:', error);
    return NextResponse.json({ error: '更新会议纪要失败' }, { status: 500 });
  }
}

async function deleteMinute(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少纪要ID' }, { status: 400 });
    }

    await deleteMeetingMinute(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete meeting minute error:', error);
    return NextResponse.json({ error: '删除会议纪要失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => listMinutes(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createMinute(req, userId));
}

export async function PUT(request: NextRequest) {
  return withAuth(request, (req, userId) => updateMinute(req, userId));
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, (req, userId) => deleteMinute(req, userId));
}

/**
 * 过程记录API - 客户对接记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getContactRecords,
  createContactRecord,
  updateContactRecord,
  deleteContactRecord,
} from '@/lib/project/process';

async function listRecords(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: '缺少项目ID' }, { status: 400 });
    }

    const records = await getContactRecords(parseInt(projectId));

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Get contact records error:', error);
    return NextResponse.json({ error: '获取对接记录失败' }, { status: 500 });
  }
}

async function createRecord(
  request: NextRequest,
  userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      projectId,
      contactType,
      contactDate,
      contactPerson,
      contactOrg,
      ourPerson,
      content,
      result,
      followUp,
      nextContactDate,
    } = body;

    if (!projectId || !contactType || !contactDate || !contactPerson || !ourPerson || !content) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const record = await createContactRecord({
      projectId,
      contactType,
      contactDate: new Date(contactDate),
      contactPerson,
      contactOrg,
      ourPerson,
      content,
      result,
      followUp,
      nextContactDate: nextContactDate ? new Date(nextContactDate) : undefined,
      createdBy: userId,
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error('Create contact record error:', error);
    return NextResponse.json({ error: '创建对接记录失败' }, { status: 500 });
  }
}

async function updateRecord(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, ...params } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    if (params.contactDate) {
      params.contactDate = new Date(params.contactDate);
    }
    if (params.nextContactDate) {
      params.nextContactDate = new Date(params.nextContactDate);
    }

    await updateContactRecord(id, params);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update contact record error:', error);
    return NextResponse.json({ error: '更新对接记录失败' }, { status: 500 });
  }
}

async function deleteRecord(
  request: NextRequest,
  _userId: number
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 });
    }

    await deleteContactRecord(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete contact record error:', error);
    return NextResponse.json({ error: '删除对接记录失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, (req, userId) => listRecords(req, userId));
}

export async function POST(request: NextRequest) {
  return withAuth(request, (req, userId) => createRecord(req, userId));
}

export async function PUT(request: NextRequest) {
  return withAuth(request, (req, userId) => updateRecord(req, userId));
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, (req, userId) => deleteRecord(req, userId));
}

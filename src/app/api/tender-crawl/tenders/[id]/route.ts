/**
 * 招标信息详情API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getTenderInfoById,
  updateTenderInfo,
  deleteTenderInfo,
  followTenderInfo,
  unfollowTenderInfo,
  ignoreTenderInfo,
} from '@/lib/tender-crawl/service';
import { parseIdFromParams } from '@/lib/api/validators';

// GET /api/tender-crawl/tenders/[id] - 获取招标信息详情
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    try {
      const p = await params;
      const tender = await getTenderInfoById(parseIdFromParams(p, 'id', '招标信息'));
      if (!tender) {
        return NextResponse.json({ error: '招标信息不存在' }, { status: 404 });
      }
      return NextResponse.json(tender);
    } catch (error) {
      console.error('获取招标信息详情失败:', error);
      return NextResponse.json({ error: '获取招标信息详情失败' }, { status: 500 });
    }
  });
}

// PUT /api/tender-crawl/tenders/[id] - 更新招标信息
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const tenderId = parseIdFromParams(p, 'id', '招标信息');
      const body = await req.json();

      if (body.action === 'follow') {
        const tender = await followTenderInfo(tenderId, userId);
        return NextResponse.json(tender);
      }

      if (body.action === 'unfollow') {
        const tender = await unfollowTenderInfo(tenderId);
        return NextResponse.json(tender);
      }

      if (body.action === 'ignore') {
        const tender = await ignoreTenderInfo(tenderId);
        return NextResponse.json(tender);
      }

      const updateData: any = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.tenderCode !== undefined) updateData.tenderCode = body.tenderCode;
      if (body.tenderType !== undefined) updateData.tenderType = body.tenderType;
      if (body.tenderOrganization !== undefined)
        updateData.tenderOrganization = body.tenderOrganization;
      if (body.tenderAgent !== undefined) updateData.tenderAgent = body.tenderAgent;
      if (body.projectType !== undefined) updateData.projectType = body.projectType;
      if (body.industry !== undefined) updateData.industry = body.industry;
      if (body.region !== undefined) updateData.region = body.region;
      if (body.budget !== undefined) updateData.budget = body.budget;
      if (body.summary !== undefined) updateData.summary = body.summary;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.requirements !== undefined) updateData.requirements = body.requirements;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.tags !== undefined) updateData.tags = body.tags;
      if (body.projectId !== undefined) updateData.projectId = body.projectId;

      const tender = await updateTenderInfo(tenderId, updateData);
      return NextResponse.json(tender);
    } catch (error) {
      console.error('更新招标信息失败:', error);
      return NextResponse.json({ error: '更新招标信息失败' }, { status: 500 });
    }
  });
}

// DELETE /api/tender-crawl/tenders/[id] - 删除招标信息
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    try {
      const p = await params;
      await deleteTenderInfo(parseIdFromParams(p, 'id', '招标信息'));
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('删除招标信息失败:', error);
      return NextResponse.json({ error: '删除招标信息失败' }, { status: 500 });
    }
  });
}

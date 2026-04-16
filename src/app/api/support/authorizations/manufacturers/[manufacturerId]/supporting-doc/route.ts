/**
 * 配套材料API路由（授权书、供货证明、售后服务承诺书）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import {
  getSupportingDoc,
  updateSupportingDoc,
  confirmSupportingDoc,
} from '@/lib/authorization/service';
import { parseIdFromParams } from '@/lib/api/validators';
import {
  canAccessAuthorizationApplication,
  getAuthorizationManufacturerApplicationId,
} from '@/lib/support/application-access';

// GET - 获取配套材料
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  return withAuth(req, async (_request, userId) => {
    try {
      const p = await params;
      const manufacturerId = parseIdFromParams(p, 'manufacturerId', '厂家');
      const applicationId = await getAuthorizationManufacturerApplicationId(manufacturerId);
      if (!applicationId) {
        return NextResponse.json({ error: '厂家不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'view');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权访问该申请' }, { status: 403 });
      }

      const doc = await getSupportingDoc(manufacturerId);
      return NextResponse.json(doc);
    } catch (error) {
      console.error('获取配套材料失败:', error);
      return NextResponse.json({ error: '获取配套材料失败' }, { status: 500 });
    }
  });
}

// PUT - 更新配套材料
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  return withAuth(req, async (request, userId) => {
    try {
      const p = await params;
      const manufacturerId = parseIdFromParams(p, 'manufacturerId', '厂家');
      const applicationId = await getAuthorizationManufacturerApplicationId(manufacturerId);
      if (!applicationId) {
        return NextResponse.json({ error: '厂家不存在' }, { status: 404 });
      }
      const permission = await canAccessAuthorizationApplication(applicationId, userId, 'edit');
      if (!permission.exists) {
        return NextResponse.json({ error: '授权申请不存在' }, { status: 404 });
      }
      if (!permission.allowed) {
        return NextResponse.json({ error: '无权修改该申请' }, { status: 403 });
      }

      const body = await request.json();

      // 特殊操作：确认配套材料
      if (body.action === 'confirm') {
        const doc = await confirmSupportingDoc(manufacturerId);
        return NextResponse.json(doc);
      }

      const doc = await updateSupportingDoc(manufacturerId, {
        authorizationLetter: body.authorizationLetter,
        authorizationLetterFileId: body.authorizationLetterFileId,
        supplyProof: body.supplyProof,
        supplyProofFileId: body.supplyProofFileId,
        serviceCommitment: body.serviceCommitment,
        serviceCommitmentNotes: body.serviceCommitmentNotes,
        serviceCommitmentFileId: body.serviceCommitmentFileId,
        validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
        validTo: body.validTo ? new Date(body.validTo) : undefined,
        submitType: body.submitType,
      });

      return NextResponse.json(doc);
    } catch (error) {
      console.error('更新配套材料失败:', error);
      return NextResponse.json({ error: '更新配套材料失败' }, { status: 500 });
    }
  });
}

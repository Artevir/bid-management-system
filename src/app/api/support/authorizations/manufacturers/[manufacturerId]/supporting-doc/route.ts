/**
 * 配套材料API路由（授权书、供货证明、售后服务承诺书）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getSupportingDoc,
  updateSupportingDoc,
  confirmSupportingDoc,
} from '@/lib/authorization/service';

// GET - 获取配套材料
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { manufacturerId } = await params;
    const id = parseInt(manufacturerId);
    const doc = await getSupportingDoc(id);

    return NextResponse.json(doc);
  } catch (error) {
    console.error('获取配套材料失败:', error);
    return NextResponse.json({ error: '获取配套材料失败' }, { status: 500 });
  }
}

// PUT - 更新配套材料
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { manufacturerId } = await params;
    const id = parseInt(manufacturerId);
    const body = await req.json();

    // 特殊操作：确认配套材料
    if (body.action === 'confirm') {
      const doc = await confirmSupportingDoc(id);
      return NextResponse.json(doc);
    }

    const doc = await updateSupportingDoc(id, {
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
}

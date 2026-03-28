/**
 * 电子签章API路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  certificateService,
  sealService,
  signService,
  eSignService,
} from '@/lib/esign/service';

// GET /api/esign - 获取证书和印章信息
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const path = req.nextUrl.pathname;

    // 获取用户证书
    if (path.endsWith('/certificates')) {
      const certificates = await certificateService.getUserCertificates(session.user.id);
      return NextResponse.json(certificates);
    }

    // 获取公司印章
    if (path.endsWith('/seals')) {
      const companyId = session.user.orgId;
      const seals = await sealService.getCompanySeals(companyId);
      return NextResponse.json(seals);
    }

    // 获取文档签名状态
    const documentId = searchParams.get('documentId');
    if (documentId) {
      const status = await eSignService.getSignStatus(parseInt(documentId));
      return NextResponse.json(status);
    }

    return NextResponse.json({ error: '请指定查询类型' }, { status: 400 });
  } catch (error) {
    console.error('获取电子签章信息失败:', error);
    return NextResponse.json({ error: '获取电子签章信息失败' }, { status: 500 });
  }
}

// POST /api/esign - 执行签章操作
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await req.json();

    // 申请证书
    if (body.action === 'applyCertificate') {
      const result = await certificateService.applyCertificate({
        userId: session.user.id,
        subject: body.subject,
        identityType: body.identityType,
        identityNumber: body.identityNumber,
      });
      return NextResponse.json(result);
    }

    // 创建印章
    if (body.action === 'createSeal') {
      const seal = await sealService.createSeal({
        companyId: session.user.orgId,
        name: body.name,
        type: body.type,
        imageData: body.imageData,
      });
      return NextResponse.json(seal);
    }

    // 签署文档
    if (body.action === 'signDocument') {
      const result = await eSignService.signAndSeal({
        documentId: body.documentId,
        certificateId: body.certificateId,
        sealId: body.sealId,
        signLocation: body.signLocation,
        userId: session.user.id,
      });
      return NextResponse.json(result);
    }

    // 验证签名
    if (body.action === 'verifySignature') {
      const result = await eSignService.verifySignedDocument(body.signedDocumentId);
      return NextResponse.json(result);
    }

    // 验证证书
    if (body.action === 'verifyCertificate') {
      const result = await certificateService.verifyCertificate(body.certificateId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('电子签章操作失败:', error);
    return NextResponse.json({ error: '电子签章操作失败' }, { status: 500 });
  }
}

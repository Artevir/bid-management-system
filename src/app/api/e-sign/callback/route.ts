/**
 * 签署回调API
 * 接收第三方签章服务商的回调通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleSignCallback } from '@/lib/e-sign/service';
import crypto from 'crypto';

function normalizeSignature(value: string): string {
  return value.replace(/^sha256=/i, '').trim().toLowerCase();
}

function verifyCallbackSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const actual = normalizeSignature(signatureHeader);
  if (!actual) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

// POST /api/e-sign/callback - 签署回调处理
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const callbackSecret = process.env.E_SIGN_CALLBACK_SECRET;
    const signatureHeader =
      req.headers.get('x-signature') ||
      req.headers.get('x-esign-signature') ||
      req.headers.get('x-sign');

    // 生产环境必须配置并验证回调签名
    if (process.env.NODE_ENV === 'production') {
      if (!callbackSecret) {
        console.error('E_SIGN_CALLBACK_SECRET is not configured in production');
        return NextResponse.json({ error: '签章回调未配置' }, { status: 500 });
      }
      if (!signatureHeader || !verifyCallbackSignature(rawBody, signatureHeader, callbackSecret)) {
        return NextResponse.json({ error: '签名验证失败' }, { status: 401 });
      }
    } else if (callbackSecret && signatureHeader) {
      // 非生产环境如果提供了签名也进行校验
      if (!verifyCallbackSignature(rawBody, signatureHeader, callbackSecret)) {
        return NextResponse.json({ error: '签名验证失败' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    // 处理回调
    await handleSignCallback({
      flowId: body.flowId || body.signFlowId || body.contractId,
      signerId: body.signerId || body.accountId || body.signerAccountId,
      status: body.status || body.signStatus,
      signedAt: body.signedAt || body.signTime,
      documentUrl: body.documentUrl || body.signedDocumentUrl || body.fileUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('处理签署回调失败:', error);
    return NextResponse.json({ error: '处理签署回调失败' }, { status: 500 });
  }
}

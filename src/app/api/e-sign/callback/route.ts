/**
 * 签署回调API
 * 接收第三方签章服务商的回调通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleSignCallback } from '@/lib/e-sign/service';

// POST /api/e-sign/callback - 签署回调处理
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 验证签名（根据不同服务商实现）
    // TODO: 添加签名验证逻辑

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

/**
 * 报价方案采纳API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adoptQuoteScheme, getQuoteSchemesByRequestId as _getQuoteSchemesByRequestId } from '@/lib/quote-analysis/service';

// POST /api/quote-analysis/schemes/[id]/adopt - 采纳报价方案
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const schemeId = parseInt(id);

    const scheme = await adoptQuoteScheme(schemeId, session.user.id);

    return NextResponse.json(scheme);
  } catch (error) {
    console.error('采纳报价方案失败:', error);
    return NextResponse.json({ error: '采纳报价方案失败' }, { status: 500 });
  }
}

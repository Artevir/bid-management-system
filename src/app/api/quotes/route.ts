import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { historicalQuotes, projects as _projects } from '@/db/schema';
import { desc, eq, and, gte, lte, sql, inArray as _inArray } from 'drizzle-orm';

/**
 * 获取历史报价列表
 * GET /api/quotes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const industry = searchParams.get('industry');
    const region = searchParams.get('region');
    const result = searchParams.get('result');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 构建查询条件
    const conditions = [];
    if (industry) conditions.push(eq(historicalQuotes.industry, industry));
    if (region) conditions.push(eq(historicalQuotes.region, region));
    if (result) conditions.push(eq(historicalQuotes.result, result));
    if (startDate) conditions.push(gte(historicalQuotes.bidDate, new Date(startDate)));
    if (endDate) conditions.push(lte(historicalQuotes.bidDate, new Date(endDate)));

    // 查询数据
    const quotes = await db
      .select()
      .from(historicalQuotes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(historicalQuotes.bidDate))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(historicalQuotes)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const total = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      quotes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Failed to fetch quotes:', error);
    return NextResponse.json(
      { error: '获取报价列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 创建历史报价记录
 * POST /api/quotes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 计算报价偏差率
    let quoteDeviation = null;
    if (body.ourQuote && body.avgQuote) {
      quoteDeviation = ((body.ourQuote - body.avgQuote) / body.avgQuote * 100).toFixed(2);
    }

    const [quote] = await db
      .insert(historicalQuotes)
      .values({
        ...body,
        quoteDeviation: quoteDeviation || body.quoteDeviation,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error('Failed to create quote:', error);
    return NextResponse.json(
      { error: '创建报价记录失败' },
      { status: 500 }
    );
  }
}

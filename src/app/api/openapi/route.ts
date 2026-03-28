/**
 * OpenAPI规范路由
 * 提供API文档的OpenAPI/Swagger规范JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/api/docs-generator';

export async function GET(request: NextRequest) {
  try {
    const spec = generateOpenAPISpec();

    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Generate OpenAPI spec error:', error);
    return NextResponse.json(
      { error: '生成API文档失败' },
      { status: 500 }
    );
  }
}

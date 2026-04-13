import { NextRequest, NextResponse } from 'next/server';

function extractForwardHeaders(headers: Headers): Record<string, string> {
  const customHeaders: Record<string, string> = {};
  const forwardHeaders = ['authorization', 'x-api-key', 'x-request-id', 'x-session-id', 'cookie'];

  for (const key of forwardHeaders) {
    const value = headers.get(key);
    if (value) {
      customHeaders[key] = value;
    }
  }

  return customHeaders;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const customHeaders = extractForwardHeaders(request.headers);
    const { FetchClient, Config } = await import('coze-coding-dev-sdk');
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    console.log('Fetching URL:', url);
    const response = await client.fetch(url);

    if (response.status_code !== 0) {
      return NextResponse.json(
        {
          error: response.status_message || 'Failed to fetch document',
          status_code: response.status_code,
        },
        { status: 500 }
      );
    }

    // 提取文本内容
    const textContent = response.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n');

    return NextResponse.json({
      title: response.title,
      url: response.url,
      content: textContent,
      filetype: response.filetype,
      publish_time: response.publish_time,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch document',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { checkFilePermission } from '@/lib/auth/resource-permission';
import { db } from '@/db';
import { files } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { S3Storage } from 'coze-coding-dev-sdk';

const hasBucketStorage = Boolean(process.env.COZE_BUCKET_ENDPOINT_URL && process.env.COZE_BUCKET_NAME);
const bucketStorage = hasBucketStorage
  ? new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    })
  : null;

async function getRawFile(
  _request: NextRequest,
  userId: number,
  fileId: number
): Promise<Response> {
  const permissionResult = await checkFilePermission(userId, fileId, 'read');
  if (!permissionResult.allowed) {
    return NextResponse.json(
      { error: permissionResult.reason || '无权下载此文件' },
      { status: 403 }
    );
  }

  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }

  if (bucketStorage) {
    const signedUrl = await bucketStorage.generatePresignedUrl({
      key: file.path,
      expireTime: 3600,
    });
    return NextResponse.redirect(signedUrl, { status: 307 });
  }

  const absolutePath = path.resolve(process.cwd(), file.path);
  const uploadsRoot = path.resolve(process.cwd(), 'uploads') + path.sep;
  if (!absolutePath.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: '非法文件路径' }, { status: 400 });
  }

  const stat = fs.statSync(absolutePath);
  const nodeStream = fs.createReadStream(absolutePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  const headers = new Headers();
  headers.set('Content-Type', file.mimeType || 'application/octet-stream');
  headers.set('Content-Length', String(stat.size));
  headers.set(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
  );

  return new NextResponse(webStream, { headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fileId = parseInt(id);
  return withAuth(request, (req, userId) => getRawFile(req, userId, fileId));
}

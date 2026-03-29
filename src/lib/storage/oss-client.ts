/**
 * 对象存储客户端
 * 集成对象存储服务（S3兼容），用于文件上传、下载和管理
 */

import { cache } from '@/lib/cache';

// ============================================
// 配置
// ============================================

const OSS_CONFIG = {
  endpoint: process.env.OSS_ENDPOINT,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  region: process.env.OSS_REGION || 'us-east-1',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '1073741824'), // 默认1GB
};

// ============================================
// 文件类型MIME映射
// ============================================

const MIME_TYPES: Record<string, string> = {
  // 图片
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  
  // 文档
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  
  // 压缩文件
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  
  // 音频
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  
  // 视频
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  
  // 其他
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.md': 'text/markdown',
};

/**
 * 获取文件的MIME类型
 */
function getMimeType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ============================================
// 对象存储客户端类
// ============================================

export class OSSClient {
  private static instance: OSSClient;

  private constructor() {}

  static getInstance(): OSSClient {
    if (!OSSClient.instance) {
      OSSClient.instance = new OSSClient();
    }
    return OSSClient.instance;
  }

  /**
   * 上传文件
   * @param file 文件对象
   * @param key 对象键（文件路径）
   * @param options 上传选项
   */
  async uploadFile(
    file: File | Buffer,
    key: string,
    options: {
      contentType?: string;
      metadata?: Record<string, string>;
      public?: boolean;
    } = {}
  ): Promise<{ url: string; key: string; size: number }> {
    try {
      // 检查配置
      if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret || !OSS_CONFIG.bucket) {
        throw new Error('对象存储配置不完整');
      }

      // 获取文件信息
      let buffer: Buffer;
      let size: number;
      let contentType = options.contentType;

      if (Buffer.isBuffer(file)) {
        buffer = file;
        size = buffer.length;
      } else {
        buffer = Buffer.from(await file.arrayBuffer());
        size = file.size;
        if (!contentType) {
          contentType = getMimeType(file.name);
        }
      }

      // 检查文件大小
      if (size > OSS_CONFIG.maxFileSize) {
        throw new Error(`文件大小超过限制（最大 ${OSS_CONFIG.maxFileSize / 1024 / 1024}MB）`);
      }

      // 这里应该调用实际的对象存储SDK（如AWS S3 SDK、阿里云OSS SDK等）
      // 由于这是模拟实现，我们返回一个模拟的URL
      const url = `${OSS_CONFIG.endpoint}/${OSS_CONFIG.bucket}/${key}`;

      // TODO: 实际上传逻辑
      // const s3 = new S3Client({ ... });
      // const command = new PutObjectCommand({ ... });
      // await s3.send(command);

      // 缓存文件信息
      await cache.set(`oss:${key}`, JSON.stringify({
        url,
        key,
        size,
        contentType,
        uploadedAt: new Date().toISOString(),
      }), 3600);

      console.log(`[OSS] 文件上传成功: ${key} (${size} bytes)`);

      return {
        url,
        key,
        size,
      };
    } catch (error) {
      console.error('[OSS] 上传文件失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件
   * @param key 对象键
   * @returns 文件流
   */
  async downloadFile(key: string): Promise<{
    stream: ReadableStream;
    contentType: string;
    size: number;
  }> {
    try {
      // TODO: 实际下载逻辑
      // const s3 = new S3Client({ ... });
      // const command = new GetObjectCommand({ Bucket: OSS_CONFIG.bucket, Key: key });
      // const response = await s3.send(command);

      // 从缓存获取文件信息
      const cached = await cache.get(`oss:${key}`);
      const fileInfo = cached ? JSON.parse(cached) : {};

      console.log(`[OSS] 文件下载成功: ${key}`);

      return {
        stream: new ReadableStream(),
        contentType: fileInfo.contentType || 'application/octet-stream',
        size: fileInfo.size || 0,
      };
    } catch (error) {
      console.error('[OSS] 下载文件失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param key 对象键
   */
  async deleteFile(key: string): Promise<void> {
    try {
      // TODO: 实际删除逻辑
      // const s3 = new S3Client({ ... });
      // const command = new DeleteObjectCommand({ Bucket: OSS_CONFIG.bucket, Key: key });
      // await s3.send(command);

      // 清除缓存
      await cache.del(`oss:${key}`);

      console.log(`[OSS] 文件删除成功: ${key}`);
    } catch (error) {
      console.error('[OSS] 删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 批量删除文件
   * @param keys 对象键列表
   */
  async deleteFiles(keys: string[]): Promise<void> {
    try {
      for (const key of keys) {
        await this.deleteFile(key);
      }
      console.log(`[OSS] 批量删除成功: ${keys.length} 个文件`);
    } catch (error) {
      console.error('[OSS] 批量删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 生成签名URL（用于前端直接上传）
   * @param key 对象键
   * @param expiresIn 过期时间（秒）
   * @returns 签名URL
   */
  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<{ url: string; headers: Record<string, string> }> {
    try {
      // TODO: 实际生成签名URL逻辑
      // const s3 = new S3Client({ ... });
      // const command = new PutObjectCommand({ ... });
      // const url = await getSignedUrl(s3, command, { expiresIn });

      const url = `${OSS_CONFIG.endpoint}/${OSS_CONFIG.bucket}/${key}?expires=${Date.now() + expiresIn * 1000}`;
      const headers = {
        'Content-Type': getMimeType(key),
        'x-amz-date': new Date().toISOString(),
      };

      return { url, headers };
    } catch (error) {
      console.error('[OSS] 生成签名URL失败:', error);
      throw error;
    }
  }

  /**
   * 复制文件
   * @param sourceKey 源对象键
   * @param targetKey 目标对象键
   */
  async copyFile(sourceKey: string, targetKey: string): Promise<void> {
    try {
      // TODO: 实际复制逻辑
      // const s3 = new S3Client({ ... });
      // const command = new CopyObjectCommand({ ... });
      // await s3.send(command);

      console.log(`[OSS] 文件复制成功: ${sourceKey} -> ${targetKey}`);
    } catch (error) {
      console.error('[OSS] 复制文件失败:', error);
      throw error;
    }
  }

  /**
   * 列出文件
   * @param prefix 前缀
   * @param maxKeys 最大数量
   */
  async listFiles(prefix: string = '', maxKeys: number = 100): Promise<{
    files: Array<{
      key: string;
      size: number;
      lastModified: Date;
      contentType: string;
    }>;
    isTruncated: boolean;
  }> {
    try {
      // TODO: 实际列出文件逻辑
      // const s3 = new S3Client({ ... });
      // const command = new ListObjectsV2Command({ ... });
      // const response = await s3.send(command);

      console.log(`[OSS] 列出文件: ${prefix}`);
      
      return {
        files: [],
        isTruncated: false,
      };
    } catch (error) {
      console.error('[OSS] 列出文件失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   * @param key 对象键
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      // TODO: 实际检查逻辑
      // const s3 = new S3Client({ ... });
      // const command = new HeadObjectCommand({ ... });
      // await s3.send(command);

      const cached = await cache.get(`oss:${key}`);
      return !!cached;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取文件信息
   * @param key 对象键
   */
  async getFileInfo(key: string): Promise<{
    key: string;
    size: number;
    contentType: string;
    lastModified: Date;
  }> {
    try {
      // TODO: 实际获取信息逻辑
      // const s3 = new S3Client({ ... });
      // const command = new HeadObjectCommand({ ... });
      // const response = await s3.send(command);

      const cached = await cache.get(`oss:${key}`);
      if (!cached) {
        throw new Error('文件不存在');
      }
      const fileInfo = JSON.parse(cached);

      return {
        key,
        size: fileInfo.size,
        contentType: fileInfo.contentType,
        lastModified: new Date(fileInfo.uploadedAt),
      };
    } catch (error) {
      console.error('[OSS] 获取文件信息失败:', error);
      throw error;
    }
  }
}

// ============================================
// 导出
// ============================================

export default OSSClient;
export { OSS_CONFIG, getMimeType };

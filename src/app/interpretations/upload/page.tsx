'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as _CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  File,
  FileSpreadsheet,
  FileImage,
} from 'lucide-react';

interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  interpretationId?: number;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const getFileIcon = (type: string) => {
  if (type.includes('spreadsheet') || type.includes('excel')) return FileSpreadsheet;
  if (type.includes('pdf')) return FileImage;
  return FileText;
};

export default function InterpretationUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return '不支持的文件格式，仅支持 PDF、Word、Excel 文件';
    }
    if (file.size > MAX_FILE_SIZE) {
      return '文件大小超过 50MB 限制';
    }
    return null;
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const error = validateFile(file);
      newFiles.push({
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const md5ArrayBuffer = (buffer: ArrayBuffer): string => {
    const rotateLeft = (x: number, c: number) => (x << c) | (x >>> (32 - c));
    const add = (a: number, b: number) => (a + b) >>> 0;
    const toHex = (n: number) => n.toString(16).padStart(8, '0');

    const bytes = new Uint8Array(buffer);
    const originalBitLen = bytes.length * 8;
    const withPaddingLen = (((bytes.length + 9 + 63) >> 6) << 6) >>> 0;
    const padded = new Uint8Array(withPaddingLen);
    padded.set(bytes);
    padded[bytes.length] = 0x80;

    const view = new DataView(padded.buffer);
    view.setUint32(withPaddingLen - 8, originalBitLen >>> 0, true);
    view.setUint32(withPaddingLen - 4, Math.floor(originalBitLen / 0x100000000) >>> 0, true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    const k = new Uint32Array(64);
    for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
    const s = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];

    for (let offset = 0; offset < withPaddingLen; offset += 64) {
      const m = new Uint32Array(16);
      for (let i = 0; i < 16; i++) {
        m[i] = view.getUint32(offset + i * 4, true);
      }

      let A = a0;
      let B = b0;
      let C = c0;
      let D = d0;

      for (let i = 0; i < 64; i++) {
        let F: number;
        let g: number;
        if (i < 16) {
          F = (B & C) | (~B & D);
          g = i;
        } else if (i < 32) {
          F = (D & B) | (~D & C);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          F = B ^ C ^ D;
          g = (3 * i + 5) % 16;
        } else {
          F = C ^ (B | ~D);
          g = (7 * i) % 16;
        }

        const tmp = D;
        D = C;
        C = B;
        const sum = add(add(add(A, F >>> 0), k[i]), m[g]);
        B = add(B, rotateLeft(sum, s[i]) >>> 0);
        A = tmp;
      }

      a0 = add(a0, A);
      b0 = add(b0, B);
      c0 = add(c0, C);
      d0 = add(d0, D);
    }

    const toLittleEndianHex = (n: number) => {
      const hex = toHex(n);
      return hex.match(/../g)!.reverse().join('');
    };

    return `${toLittleEndianHex(a0)}${toLittleEndianHex(b0)}${toLittleEndianHex(c0)}${toLittleEndianHex(d0)}`;
  };

  const calculateMd5 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const subtle = globalThis.crypto?.subtle;
    if (subtle?.digest) {
      const hashBuffer = await subtle.digest('MD5', buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return md5ArrayBuffer(buffer);
  };

  const uploadFile = async (index: number) => {
    const uploadedFile = files[index];
    if (uploadedFile.status === 'uploading') return;

    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: 'uploading', progress: 10 } : f))
    );

    try {
      // 1. 计算文件MD5
      const md5 = await calculateMd5(uploadedFile.file);
      
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 30 } : f))
      );

      // 2. 上传文件到存储服务
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '文件上传失败');
      }

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, progress: 60 } : f))
      );

      // 3. 创建解读记录
      const ext = uploadedFile.file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const createResponse = await fetch('/api/interpretations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: uploadedFile.file.name,
          documentUrl: uploadResult.data.url,
          documentExt: ext,
          documentSize: uploadedFile.file.size,
          documentMd5: md5,
        }),
      });

      const createResult = await createResponse.json();
      if (!createResult.success) {
        throw new Error(createResult.error || '创建记录失败');
      }

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, progress: 100, status: 'success', interpretationId: createResult.data.id }
            : f
        )
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : '上传失败',
              }
            : f
        )
      );
    }
  };

  const startParse = async (index: number) => {
    const uploadedFile = files[index];
    if (!uploadedFile.interpretationId) return;

    try {
      await fetch(`/api/interpretations/${uploadedFile.interpretationId}/parse`, {
        method: 'POST',
      });
      router.push(`/interpretations/${uploadedFile.interpretationId}`);
    } catch (error) {
      console.error('启动解析失败:', error);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileExtension = (name: string) => {
    return name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">上传招标文件</h1>
        <p className="text-muted-foreground">
          上传招标文件，系统将自动解析提取关键信息
        </p>
      </div>

      {/* 支持格式提示 */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          支持的文件格式：PDF、Word（.doc/.docx）、Excel（.xls/.xlsx），单文件最大 50MB
        </AlertDescription>
      </Alert>

      {/* 拖拽上传区域 */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">拖拽文件到此处上传</p>
          <p className="text-sm text-muted-foreground mb-4">或点击下方按钮选择文件</p>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            选择文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* 文件列表 */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">待上传文件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((item, index) => {
              const FileIcon = getFileIcon(item.file.type);
              const ext = getFileExtension(item.file.name);

              return (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{item.file.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {ext}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {formatFileSize(item.file.size)}
                    </p>

                    {/* 进度条 */}
                    {(item.status === 'uploading' || item.status === 'success') && (
                      <div className="space-y-1">
                        <Progress value={item.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">{item.progress}%</p>
                      </div>
                    )}

                    {/* 错误信息 */}
                    {item.status === 'error' && (
                      <p className="text-sm text-destructive">{item.error}</p>
                    )}

                    {/* 成功后操作 */}
                    {item.status === 'success' && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => startParse(index)}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          开始解析
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 状态图标 */}
                  <div className="flex items-center gap-2">
                    {item.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    )}
                    {item.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => uploadFile(index)}>
                        上传
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                      disabled={item.status === 'uploading'}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 批量操作 */}
      {files.length > 1 && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setFiles([])}
            disabled={files.some((f) => f.status === 'uploading')}
          >
            清空列表
          </Button>
          <Button
            onClick={() => {
              files.forEach((f, i) => {
                if (f.status === 'pending') uploadFile(i);
              });
            }}
            disabled={files.every((f) => f.status !== 'pending')}
          >
            全部上传
          </Button>
        </div>
      )}

      {/* 返回按钮 */}
      <div className="flex justify-start">
        <Button variant="ghost" onClick={() => router.push('/interpretations')}>
          返回列表
        </Button>
      </div>
    </div>
  );
}

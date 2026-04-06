'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';

interface UploadFile {
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function SmartReviewUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    const newFiles: UploadFile[] = selectedFiles.map(file => ({
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
    }));

    setFiles(prev => [...prev, ...newFiles]);
    
    // 触发上传
    if (newFiles.length > 0) {
      await uploadFiles([...files, ...newFiles]);
    }
  };

  const uploadFiles = async (filesToUpload: UploadFile[]) => {
    setUploading(true);
    
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileData = filesToUpload[i];
      
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading', progress: 10 } : f
      ));

      try {
        // 1. 获取上传URL
        const presignRes = await fetch('/api/files/multipart/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: fileData.file.name,
            fileType: fileData.file.type,
          }),
        });
        
        const presignData = await presignRes.json();
        
        if (!presignRes.ok) {
          throw new Error(presignData.error || '获取上传URL失败');
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 30 } : f
        ));

        // 2. 分片上传
        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('sessionId', presignData.sessionId);
        
        const uploadRes = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        
        const uploadData = await uploadRes.json();
        
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || '文件上传失败');
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 60 } : f
        ));

        // 3. 创建智能审阅文档记录
        const fileMd5 = await calculateFileMd5(fileData.file);
        
        const createRes = await fetch('/api/smart-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: fileData.file.name,
            fileUrl: uploadData.fileUrl,
            fileExt: fileData.file.name.split('.').pop() || '',
            fileSize: fileData.file.size,
            filePageCount: 0,
            fileMd5,
          }),
        });
        
        const createData = await createRes.json();
        
        if (!createRes.ok) {
          if (createRes.status === 409) {
            throw new Error('文件已存在');
          }
          throw new Error(createData.error || '创建文档记录失败');
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 80, status: 'success' } : f
        ));

        // 4. 触发AI解析
        if (createData.document) {
          await fetch(`/api/smart-review/${createData.document.id}/parse`, {
            method: 'POST',
          });
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 100 } : f
        ));

      } catch (error: any) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: error.message } : f
        ));
      }
    }
    
    setUploading(false);
  };

  const calculateFileMd5 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const wordArray = new Uint8Array(arrayBuffer);
        let hash = '';
        for (let i = 0; i < Math.min(wordArray.length, 1024); i++) {
          hash += wordArray[i].toString(16).padStart(2, '0');
        }
        resolve(hash);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(0, 1024));
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/smart-review')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <div>
          <h1 className="text-2xl font-bold">上传招标文件</h1>
          <p className="text-gray-500">支持PDF、DOC、DOCX、XLS、XLSX格式</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>文件上传</CardTitle>
              <CardDescription>点击或拖拽文件到此处上传</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium mb-2">
                  点击选择文件或拖拽到此处
                </p>
                <p className="text-sm text-gray-500">
                  支持 PDF、DOC、DOCX、XLS、XLSX 格式，单个文件最大100MB
                </p>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <FileText className="h-8 w-8 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium truncate">{file.name}</span>
                          <span className="text-sm text-gray-500">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={file.progress} className="flex-1" />
                          {file.status === 'success' && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          {file.status === 'error' && (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          {file.status === 'uploading' && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                        </div>
                        {file.error && (
                          <p className="text-sm text-red-500 mt-1">{file.error}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={file.status === 'uploading'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>上传说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">支持的文件格式</h4>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• PDF (.pdf)</li>
                  <li>• Word 97-2003 (.doc)</li>
                  <li>• Word 2007+ (.docx)</li>
                  <li>• Excel 97-2003 (.xls)</li>
                  <li>• Excel 2007+ (.xlsx)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">自动处理流程</h4>
                <ol className="text-sm text-gray-500 space-y-1 list-decimal list-inside">
                  <li>文件上传并计算MD5</li>
                  <li>AI自动解析招标文件</li>
                  <li>提取结构化信息</li>
                  <li>生成响应矩阵</li>
                  <li>提交审核</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium mb-2">提取的信息</h4>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• 项目基本信息</li>
                  <li>• 费用相关信息</li>
                  <li>• 时间节点</li>
                  <li>• 技术规格要求</li>
                  <li>• 评分细则</li>
                  <li>• 资质要求</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

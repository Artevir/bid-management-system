'use client';

import { useParams } from 'next/navigation';
import { ParseDashboard } from '@/components/parse/parse-dashboard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProjectParsePage() {
  const params = useParams();
  const projectId = parseInt(params.id as string);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回项目
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文档解析</h1>
          <p className="text-muted-foreground">
            智能解析招标文档，提取关键信息
          </p>
        </div>
      </div>

      <ParseDashboard projectId={projectId} />
    </div>
  );
}

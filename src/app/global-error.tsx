'use client';

import { useEffect } from 'react';
import { hardReloadForNewDeployment, isChunkOrModuleLoadError } from '@/lib/client/chunk-error';

export default function GlobalError({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-4">
            <div className="text-xl font-semibold">应用发生错误</div>
            <div className="text-sm break-words">{error?.digest ? `digest: ${error.digest}` : null}</div>
            <pre className="text-sm whitespace-pre-wrap break-words rounded-md border p-4 overflow-auto">
              {error?.message || '未知错误'}
            </pre>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-white"
              onClick={() => {
                if (isChunkOrModuleLoadError(error)) {
                  hardReloadForNewDeployment();
                  return;
                }
                reset();
              }}
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import AppLayout from '@/components/layout/app-layout';
import { ChunkLoadRecovery } from '@/components/chunk-load-recovery';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { CHUNK_RELOAD_SESSION_KEY } from '@/lib/client/chunk-error';

/** Runs before React / layout chunk — fixes "Loading chunk failed" when that chunk never loads. */
const chunkRecoveryInlineScript = `(function(){var k=${JSON.stringify(CHUNK_RELOAD_SESSION_KEY)};function go(){try{if(sessionStorage.getItem(k))return;}catch(e){}try{sessionStorage.setItem(k,"1");}catch(e){}location.reload();}window.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="SCRIPT"&&t.src&&t.src.indexOf("/_next/static/")!==-1)go();},true);window.addEventListener("unhandledrejection",function(e){var r=e.reason,m="",n="";try{if(r&&typeof r==="object"){m=String(r.message||"");n=String(r.name||"");}else{m=String(r||"");}}catch(x){}if(n==="ChunkLoadError"||m.indexOf("Loading chunk")!==-1||m.indexOf("Failed to fetch dynamically imported module")!==-1){e.preventDefault();go();}});setTimeout(function(){try{sessionStorage.removeItem(k);}catch(e){}},15e3);})();`;

export const metadata: Metadata = {
  title: {
    default: '标书全流程管理平台',
    template: '%s | 标书管理平台',
  },
  description: '标书全流程管理平台 - AI-native智能编标与审核系统',
  keywords: [
    '标书管理',
    '投标',
    '招标',
    'AI编标',
    '智能审校',
    '知识库',
  ],
  authors: [{ name: 'Coze Code Team' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: chunkRecoveryInlineScript }} />
        <ChunkLoadRecovery />
        <ReactQueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AppLayout>
              {children}
            </AppLayout>
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import AppLayout from '@/components/layout/app-layout';

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
      </body>
    </html>
  );
}

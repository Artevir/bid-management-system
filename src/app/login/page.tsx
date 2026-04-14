'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { extractErrorMessage } from '@/lib/error-message';
import { 
  AlertCircle, 
  Loader2, 
  FileText, 
  Shield, 
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(extractErrorMessage(data, '登录失败'));
        return;
      }

      // 登录成功后优先回跳原目标页
      const nextPath =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('next')
          : null;
      const safeNextPath = nextPath && nextPath.startsWith('/') ? nextPath : '/';
      router.push(safeNextPath);
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区域 - 桌面端显示 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70">
        {/* 背景装饰 */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        </div>
        
        {/* 网格背景 */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        {/* 内容 */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <FileText className="h-8 w-8" />
            </div>
            <span className="text-2xl font-bold">标书管理平台</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-4 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
            AI 驱动的
            <br />
            智能投标管理
          </h1>
          
          <p className="text-lg text-white/80 mb-8 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
            一站式投标全流程管理，助力企业提升中标率
          </p>
          
          {/* 特性列表 */}
          <div className="space-y-4 animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-white/90">AI 智能编标与审校</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Shield className="h-5 w-5" />
              </div>
              <span className="text-white/90">四级审核流程管控</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-white/90">企业知识库沉淀</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 右侧登录区域 */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="p-2 bg-primary/10 rounded-xl">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold">标书管理平台</span>
          </div>
          
          <Card className="border-0 shadow-xl animate-scale-in">
            <CardHeader className="space-y-1 text-center pb-6">
              <CardTitle className="text-2xl font-bold">欢迎回来</CardTitle>
              <CardDescription>请输入您的账号密码登录系统</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive" className="animate-shake">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{String(error)}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">
                    用户名
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 transition-all focus:ring-2 focus:ring-primary/20"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    密码
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-11 pr-10 transition-all focus:ring-2 focus:ring-primary/20"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-medium transition-all hover:shadow-lg hover:shadow-primary/25 btn-press" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '登 录'
                  )}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>默认账号：admin / admin123</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  首次使用请及时修改默认密码
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* 底部信息 */}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            © 2024 标书管理平台 · 企业级投标解决方案
          </p>
        </div>
      </div>
    </div>
  );
}

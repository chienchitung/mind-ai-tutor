'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    // 創建 Supabase 客戶端
    const client = createClient();
    setSupabase(client);
    
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await client.auth.getUser();
      
      if (user) {
        router.push('/dashboard');
      }
    };
    
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    
    if (!email || !password) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 使用 Supabase 進行登入
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });
      
      // 確保資料存在且用戶已認證
      if (data?.user) {
        // 使用 router.push 進行重定向
        router.refresh(); // 刷新頁面以更新身份驗證狀態
        router.push('/dashboard');
      }
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message || 'Failed to log in. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 獲取當前 URL 中的 redirect 參數，如果有的話
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPath = urlParams.get('redirect') || '/dashboard';
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/auth/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            redirect: redirectPath
          }
        }
      });
      
      if (error) {
        console.error('Google login error:', error);
        throw error;
      }
      
      // 記錄重定向 URL 並提示用戶正在重定向
      console.log('Google sign in initiated, redirect URL:', data?.url);
      
      // 顯示轉場提示，避免使用者覺得頁面凍結
      toast({
        title: 'Redirecting to Google',
        description: 'You will now be redirected to Google for authentication.',
      });
      
      // 客戶端重定向到 Google 授權頁面
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message || 'Failed to log in with Google. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-primary">MindAiTutor</h1>
        <p className="mt-2 text-muted-foreground">AI-powered student tracking and tutoring system</p>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your email to sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                name="email"
                placeholder="name@example.com" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input 
                id="password" 
                name="password"
                placeholder="••••••••" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <Image 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              width={20} 
              height={20} 
              className="mr-2"
            />
            Google
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
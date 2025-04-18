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

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [supabase, setSupabase] = useState<any>(null);
  
  useEffect(() => {
    // 在客戶端創建 Supabase 客戶端
    const initializeSupabase = async () => {
      const { supabase } = await import('@/lib/supabase');
      const client = supabase();
      setSupabase(client);
    };
    
    initializeSupabase();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      console.error('Supabase client not initialized');
      return;
    }
    
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            subscription_plan: 'Free plan'
          }
        }
      });
      
      if (error) {
        throw error;
      }

      if (data?.user?.identities?.length === 0) {
        toast({
          title: 'Email already registered',
          description: 'This email is already registered. Please try logging in instead.',
          variant: 'destructive',
        });
        router.push('/login');
        return;
      }
      
      // Check if email confirmation is required
      if (data?.user?.confirmed_at) {
        // Email already confirmed, proceed to dashboard
        toast({
          title: 'Sign up successful',
          description: 'Welcome to MindAiTutor!',
        });
        router.push('/dashboard');
      } else {
        // Email confirmation required
        toast({
          title: 'Sign up successful',
          description: 'Please check your email to verify your account. You will be redirected to the login page.',
          duration: 5000,
        });
        
        // Add a delay before redirecting to login
        setTimeout(() => {
          router.push('/login');
        }, 5000);
      }
      
    } catch (error: any) {
      toast({
        title: 'Sign up failed',
        description: error.message || 'Failed to sign up. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
        console.error('Google signup error:', error);
        throw error;
      }
      
      // 記錄重定向 URL 並提示用戶正在重定向
      console.log('Google sign up initiated, redirect URL:', data?.url);
      
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
        title: 'Sign up failed',
        description: error.message || 'Failed to sign up with Google. Please try again.',
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
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>Enter your details to sign up</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSignUp} className="space-y-4" autoComplete="on">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input 
                  id="firstName" 
                  name="given-name"
                  placeholder="John" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input 
                  id="lastName" 
                  name="family-name"
                  placeholder="Doe" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                name="password"
                placeholder="••••••••" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                name="confirm-password"
                placeholder="••••••••" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? 'Signing up...' : 'Sign Up'}
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
            onClick={handleGoogleSignUp}
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
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
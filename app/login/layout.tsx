'use client';

import { Toaster } from '@/components/ui/toaster';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginLayoutProps {
  children: React.ReactNode;
}

export default function LoginLayout({ children }: LoginLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        // 動態導入 supabase 函數以避免服務器端渲染問題
        const { supabase } = await import('../../lib/supabase');
        const supabaseClient = supabase();
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
          // If user is logged in, redirect to dashboard
          router.push('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-4">
      {children}
      <Toaster />
    </div>
  );
} 
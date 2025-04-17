import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Use environment variables instead of hardcoded values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Add validation in case environment variables are not set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

export async function middleware(request: NextRequest) {
  try {
    // Initialize Supabase
    const supabase = createClient<Database>(
      SUPABASE_URL || '',
      SUPABASE_ANON_KEY || '', 
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
      }
    );

    // Get the pathname from the URL
    const pathname = request.nextUrl.pathname;
    
    // 使用 URL 重寫代替重定向，這樣可以保持原始 URL 但顯示不同內容
    if (pathname === '/courses' || pathname.startsWith('/courses/')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace('/courses', '/digital-games');
      return NextResponse.rewrite(url); // 使用 rewrite 替代 redirect，這會維持原始 URL 但顯示不同內容
    }
    
    // Skip auth check for public routes
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/public') ||
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/' ||
      pathname === '/auth/callback' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password'
    ) {
      return NextResponse.next();
    }
    
    // Get all cookies
    const allCookies = request.cookies.getAll();
    
    // Look for any authentication related cookies with broader criteria
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('-auth-token') || 
      cookie.name.includes('supabase.auth') ||
      cookie.name.includes('sb-') ||
      cookie.name.includes('_auth_token')
    );
    
    if (process.env.NODE_ENV === 'production' && pathname === '/dashboard') {
      console.log('Debug - All cookies in production:', allCookies.map(c => c.name));
      console.log('Debug - Auth cookies found:', authCookies.length);
    }
    
    // 對於需要身份驗證的路由，我們仍然需要使用重定向
    // 因為這是安全需求，我們不能顯示未授權用戶請求的內容
    if (authCookies.length === 0 && (pathname.startsWith('/api') || pathname.startsWith('/students') || pathname.startsWith('/dashboard'))) {
      // For debugging in production
      if (process.env.NODE_ENV === 'production') {
        console.log('Redirecting to login. No auth cookies found.');
      }
      
      const url = new URL('/login', request.url);
      return NextResponse.redirect(url, { status: 302 }); // 必須重定向以保護未授權訪問
    }
    
    if (authCookies.length > 0 && pathname === '/login') {
      // 已登入用戶訪問登入頁面，重定向到儀表板
      const url = new URL('/dashboard', request.url);
      return NextResponse.redirect(url, { status: 302 }); // 必須重定向以避免已登入用戶重複登入
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error: ', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
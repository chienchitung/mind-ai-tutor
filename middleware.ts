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
    // Get the pathname from the URL
    const pathname = request.nextUrl.pathname;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // 日誌：記錄環境和請求路徑
    if (isProduction) {
      console.log(`[Middleware] Environment: ${process.env.NODE_ENV}, Path: ${pathname}`);
    }
    
    // 檢查 /auth/callback 路徑 - 這個路徑需要特殊處理，避免重定向循環
    if (pathname === '/auth/callback') {
      // 對於 auth callback，我們總是直接放行，不做任何重定向
      if (isProduction) console.log('[Middleware] Auth callback detected, passing through');
      return NextResponse.next();
    }

    // 使用 URL 重寫代替重定向，這樣可以保持原始 URL 但顯示不同內容
    if (pathname === '/courses' || pathname.startsWith('/courses/')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace('/courses', '/digital-games');
      if (isProduction) console.log(`[Middleware] Rewriting ${pathname} to ${url.pathname}`);
      return NextResponse.rewrite(url); // 使用 rewrite 替代 redirect
    }
    
    // Skip auth check for public routes
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon.ico') ||
      pathname.startsWith('/public') ||
      pathname === '/login' ||  // 讓登入頁正常通過
      pathname === '/signup' ||
      pathname === '/' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password'
    ) {
      if (isProduction && !pathname.startsWith('/_next')) {
        console.log(`[Middleware] Public route detected: ${pathname}, passing through`);
      }
      return NextResponse.next();
    }
    
    // 初始化 Supabase - 只在需要時才初始化，提高效率
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
    
    // Get all cookies
    const allCookies = request.cookies.getAll();
    
    // Look for any authentication related cookies with broader criteria
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('-auth-token') || 
      cookie.name.includes('supabase.auth') ||
      cookie.name.includes('sb-') ||
      cookie.name.includes('_auth_token')
    );
    
    if (isProduction) {
      console.log(`[Middleware] Path: ${pathname}, Auth cookies found: ${authCookies.length}`);
      if (authCookies.length > 0) {
        console.log(`[Middleware] Auth cookie names: ${authCookies.map(c => c.name).join(', ')}`);
      }
    }
    
    // 對於需要身份驗證的路由，檢查是否有有效的認證 cookie
    if (authCookies.length === 0 && (pathname.startsWith('/api') || pathname.startsWith('/students') || pathname.startsWith('/dashboard'))) {
      if (isProduction) {
        console.log(`[Middleware] Unauthorized access to ${pathname}, redirecting to login`);
      }
      
      // 重要：這裡必須使用重定向，因為我們需要實際改變 URL 到登入頁
      // 雖然會出現 307，但這是必要的安全措施
      const url = new URL('/login', request.url);
      return NextResponse.redirect(url, { status: 302 });
    }
    
    // 這個條件檢查是否用戶已經登入但嘗試訪問登入頁
    // 標準的登入流程不會進入這裡，這只是防止已登入用戶再次訪問登入頁
    if (authCookies.length > 0 && pathname === '/login') {
      if (isProduction) {
        console.log('[Middleware] Authenticated user accessing login, redirecting to dashboard');
      }
      
      // 這裡使用重定向是必要的，因為登入後用戶應該真正前往儀表板
      const url = new URL('/dashboard', request.url);
      return NextResponse.redirect(url, { status: 302 });
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
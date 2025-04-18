import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 創建初始的響應對象
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // 這將設置 cookie 於當前的響應
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            maxAge: 0,
            path: '/',
          });
        },
      },
    }
  );

  // 重要：不要在 createServerClient 和 supabase.auth.getUser() 之間放置代碼
  // 這可能會導致用戶被隨機登出，很難調試

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 跳過 auth 路徑的處理，以避免循環重定向
  if (request.nextUrl.pathname.startsWith('/auth')) {
    return response;
  }

  // 處理需要身份驗證的路徑
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    // 用戶未登入，重定向到登入頁面
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 如果用戶已登入但訪問登入頁面，重定向到儀表板
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  // 重要：必須按原樣返回 response 對象
  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/auth/callback',
  ],
};
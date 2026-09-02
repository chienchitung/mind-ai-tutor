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

  // 需要登入才能進入的頁面。這份清單以外的路徑（/live、/live/[id] 加入頁、
  // /quiz/[id] 公開測驗頁、/login 等驗證頁）刻意不受身份驗證保護，本來就是
  // 匿名使用者要能進去的頁面。以後新增需要登入的頁面，只要加進這份清單，
  // 同時把對應路徑加進下方 config.matcher，否則 middleware 根本不會被叫到。
  const PROTECTED_PATHS = [
    '/dashboard',
    '/students',
    '/lessons',
    '/digital-games',
    '/ai-quiz',
    '/events',
    '/feedback',
    '/activities',
    '/reports',
    '/settings',
    '/profile',
    '/subscription',
    '/live/new',
    '/live/sessions',
  ];
  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  ) || /^\/live\/[^/]+\/present(\/|$)/.test(request.nextUrl.pathname);

  if (!user && isProtectedPath) {
    // 用戶未登入，重定向到登入頁面
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 只有 role = admin 的帳號能進入這些路徑。以後要新增 admin 專屬頁面，
  // 只需要在這份清單加一行，不用重寫判斷邏輯。
  const ADMIN_ONLY_PATHS = ['/admin'];
  const isAdminOnlyPath = ADMIN_ONLY_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAdminOnlyPath) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
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
    '/admin/:path*',
    '/students/:path*',
    '/lessons/:path*',
    '/digital-games/:path*',
    '/ai-quiz/:path*',
    '/events/:path*',
    '/feedback/:path*',
    '/activities/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/profile/:path*',
    '/subscription/:path*',
    '/live/new/:path*',
    '/live/sessions/:path*',
    '/live/:id/present/:path*',
    '/login',
    '/auth/callback',
  ],
};
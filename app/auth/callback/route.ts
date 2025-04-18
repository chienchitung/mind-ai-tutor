import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // 獲取重定向 URL，預設為 dashboard
  const redirectTo = requestUrl.searchParams.get('redirect') || '/dashboard';

  if (!code) {
    // 沒有授權碼，返回錯誤頁面
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', maxAge: 0, path: '/' });
        },
      },
    }
  );

  // 使用授權碼交換會話，Supabase 會自動處理會話存儲
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  
  if (error) {
    console.error('Auth callback error:', error.message);
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url));
  }

  // 獲取用戶資料以設置初始元數據
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // 確保用戶有基本的 metadata
    if (!user.user_metadata?.subscription_plan) {
      await supabase.auth.updateUser({
        data: {
          subscription_plan: 'Free plan'
        }
      });
    }
    
    // 從 Google 登入設置用戶姓名
    if (!user.user_metadata?.full_name && user.user_metadata?.name) {
      const nameParts = user.user_metadata.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: user.user_metadata.name,
        }
      });
    }
  }

  // 重定向到指定頁面
  return NextResponse.redirect(new URL(redirectTo, request.url));
} 
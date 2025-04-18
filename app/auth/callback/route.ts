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
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options });
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
    console.log("User metadata from Google:", user.user_metadata);
    
    // 確保用戶有基本的 metadata
    if (!user.user_metadata?.subscription_plan) {
      await supabase.auth.updateUser({
        data: {
          subscription_plan: 'Free plan'
        }
      });
    }
    
    // 從 Google 登入設置用戶姓名
    if (user.app_metadata?.provider === 'google') {
      // 優先使用 Google OAuth 提供的 given_name 和 family_name
      let firstName = '';
      let lastName = '';
      
      if (user.user_metadata?.given_name && user.user_metadata?.family_name) {
        // 如果 Google 提供了明確的 given_name 和 family_name
        firstName = user.user_metadata.given_name;
        lastName = user.user_metadata.family_name;
      } else if (user.user_metadata?.name) {
        // 退回到完整名稱的分割方式（但這可能不准確）
        // 這裡假設最後一個詞是姓氏，其餘都是名字
        const nameParts = user.user_metadata.name.split(' ');
        if (nameParts.length > 1) {
          firstName = nameParts.slice(0, nameParts.length - 1).join(' ');
          lastName = nameParts[nameParts.length - 1];
        } else {
          firstName = nameParts[0] || '';
          lastName = '';
        }
      }
      
      console.log("Extracted name parts:", { firstName, lastName });
      
      await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: user.user_metadata?.name || `${firstName} ${lastName}`.trim(),
        }
      });
    }
  }

  // 重定向到指定頁面
  return NextResponse.redirect(new URL(redirectTo, request.url));
} 
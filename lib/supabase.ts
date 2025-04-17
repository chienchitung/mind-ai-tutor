import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// This check ensures we provide helpful messages when credentials are missing
if (!supabaseUrl || !supabaseAnonKey) {
  if (!supabaseUrl) console.error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) console.error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  // Still proceed with empty strings for development, but log warnings
  console.warn('Supabase client initialized with missing credentials');
}

// 確定當前環境
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Create a single instance of the Supabase client with options
export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // Required for OAuth via URL
      storageKey: 'supabase.auth.token', // Custom storage key to be consistent
      // 使用新版 Supabase 客戶端支持的會話配置
      flowType: 'pkce', // 推薦的認證流程，更安全
    }
  }
);

// 自定義函數來手動設置 Supabase cookie - 在登入頁面使用
export const setSupabaseCookies = (session: any) => {
  if (!session) return false;
  
  try {
    // 在當前域名上設置 cookie
    const secureFlag = !isLocalhost ? '; Secure' : '';
    const domain = isLocalhost ? 'localhost' : window.location.hostname;
    
    document.cookie = `sb-access-token=${session.access_token}; Domain=${domain}; Path=/; Max-Age=28800; SameSite=Lax${secureFlag}`;
    document.cookie = `sb-refresh-token=${session.refresh_token}; Domain=${domain}; Path=/; Max-Age=604800; SameSite=Lax${secureFlag}`;
    
    console.log('Supabase cookies set manually');
    return true;
  } catch (error) {
    console.error('Error setting Supabase cookies manually:', error);
    return false;
  }
};

// 初始化時進行會話檢查並輸出日誌，幫助調試
if (typeof window !== 'undefined') {
  // 檢查現有會話
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Error checking Supabase session:', error);
    } else {
      console.log(`Supabase session check: ${data.session ? 'Session exists' : 'No session'}`);
      if (data.session && data.session.expires_at) {
        console.log('Session expires at:', new Date(data.session.expires_at * 1000).toLocaleString());
      }
    }
  });
}

// Validate environment variables
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Supabase credentials not found. Please check your .env.local file.');
} 
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// 環境變數
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// This check ensures we provide helpful messages when credentials are missing
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  if (!supabaseUrl) console.error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) console.error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  // Still proceed with empty strings for development, but log warnings
  console.warn('Supabase client initialized with missing credentials');
}

// 確定當前環境
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// 確保只創建一個 Supabase 客戶端實例
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

// 創建 Supabase 客戶端單例
export const supabase = () => {
  if (supabaseClient) return supabaseClient;
  
  // 客戶端只能在瀏覽器中初始化
  if (typeof window === 'undefined') {
    throw new Error('This method should only be called in the browser');
  }
  
  supabaseClient = createBrowserClient(
    supabaseUrl || '',
    supabaseAnonKey || '',
  );
  
  // 初始化時進行會話檢查並輸出日誌，幫助調試
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Error checking Supabase session:', error);
    } else {
      console.log(`Supabase session check: ${data.session ? 'Session exists' : 'No session'}`);
      if (data.session && data.session.expires_at) {
        console.log('Session expires at:', new Date(data.session.expires_at * 1000).toLocaleString());
      }
    }
  });
  
  return supabaseClient;
};

// Validate environment variables
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn('Supabase credentials not found. Please check your .env.local file.');
} 
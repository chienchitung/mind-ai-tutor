import { createBrowserClient, createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 瀏覽器客戶端單例
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

// Create a browser client for client-side components
export function createClient() {
  // 檢測客戶端調用，但不阻止服務器端調用
  if (browserClient) return browserClient;
  
  // 只在瀏覽器環境中創建實際客戶端
  if (typeof window !== 'undefined') {
    browserClient = createBrowserClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    return browserClient;
  }
  
  // 在服務器端返回一個空的模擬客戶端
  // 這將在客戶端水合（hydration）時被替換
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      // 添加其他常用方法的模擬實現
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
  } as any;
}

// Create a server client for server-side components
export async function getServerClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
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
} 
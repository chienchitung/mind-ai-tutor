import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  try {
    console.log('讀取學習紀錄...');
    
    // Create a server-side Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            // In API routes, we typically don't set cookies via this method
            // But keep implementation for completeness
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            // In API routes, we typically don't remove cookies via this method
            // But keep implementation for completeness
            cookieStore.set({ name, value: '', maxAge: 0, path: '/' });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 從數據庫獲取學習紀錄
    let { data, error } = await supabase
      .from('learning_records')
      .select('*');
    
    if (error) {
      console.error('嘗試從 public.learning_records 取得數據失敗:', error);
      
      // 如果上面的查詢失敗，嘗試查詢帶schema的表
      console.log('嘗試從 learning_records.learning_records 取得數據...');
      const response = await supabase
        .from('learning_records.learning_records')
        .select('*');
      
      data = response.data;
      error = response.error;
      
      if (error) {
        console.error('嘗試從 learning_records.learning_records 獲取數據也失敗:', error);
      }
    }
    
    if (error) {
      return NextResponse.json({ 
        error: '無法獲取數據',
        details: error.message
      }, { status: 500 });
    }
    
    console.log('成功獲取學習紀錄');
    return NextResponse.json({ 
      success: true, 
      message: '學習紀錄獲取成功', 
      count: data?.length || 0,
      data
    });
  } catch (error) {
    console.error('獲取數據時發生意外錯誤:', error);
    return NextResponse.json({ 
      error: '意外錯誤',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
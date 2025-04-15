import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// 更新種子數據以匹配截圖中顯示的數據
const sampleRecords = [
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 1,
    started_at: '2025-03-01 00:58:16.828+08',
    completed_at: '2025-03-01 00:58:23.828+08',
    time_spent_seconds: 7 * 60,
    category: 'Mathematics'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 2,
    started_at: '2025-03-01 00:58:25.136+08',
    completed_at: '2025-03-01 00:58:29.136+08',
    time_spent_seconds: 4 * 60,
    category: 'Science'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 3,
    started_at: '2025-03-01 00:58:31.36+08',
    completed_at: '2025-03-01 00:58:37.36+08',
    time_spent_seconds: 6 * 60,
    category: 'Physics'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 4,
    started_at: '2025-03-01 00:58:38.707+08',
    completed_at: '2025-03-01 00:58:45.707+08',
    time_spent_seconds: 7 * 60,
    category: 'Chemistry'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 5,
    started_at: '2025-03-01 00:58:51.074+08',
    completed_at: '2025-03-01 00:58:57.074+08',
    time_spent_seconds: 6 * 60,
    category: 'Biology'
  },
  {
    student_id: '123',
    student_name: 'molly',
    lesson_id: 1,
    started_at: '2025-03-01 01:02:45.376+08',
    completed_at: '2025-03-01 01:02:51.376+08',
    time_spent_seconds: 6 * 60,
    category: 'Mathematics'
  },
  {
    student_id: '123',
    student_name: 'molly',
    lesson_id: 2,
    started_at: '2025-03-01 01:02:52.984+08',
    completed_at: '2025-03-01 01:02:57.984+08',
    time_spent_seconds: 5 * 60,
    category: 'Science'
  },
  {
    student_id: '123',
    student_name: 'molly',
    lesson_id: 3,
    started_at: '2025-03-01 01:02:59.729+08',
    completed_at: '2025-03-01 01:03:08.729+08',
    time_spent_seconds: 9 * 60,
    category: 'Physics'
  },
  {
    student_id: '123',
    student_name: 'molly',
    lesson_id: 4,
    started_at: '2025-03-01 01:03:10.071+08',
    completed_at: '2025-03-01 01:03:21.071+08',
    time_spent_seconds: 11 * 60,
    category: 'Chemistry'
  },
  {
    student_id: '123',
    student_name: 'molly',
    lesson_id: 5,
    started_at: '2025-03-01 01:03:26.744+08',
    completed_at: '2025-03-01 01:03:32.744+08',
    time_spent_seconds: 6 * 60,
    category: 'Biology'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 1,
    started_at: '2025-03-01 01:07:16.432+08',
    completed_at: '2025-03-01 01:07:22.432+08',
    time_spent_seconds: 6 * 60,
    category: 'Mathematics Review'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 2,
    started_at: '2025-03-01 01:07:24.797+08',
    completed_at: '2025-03-01 01:07:32.797+08',
    time_spent_seconds: 8 * 60,
    category: 'Science Review'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 3,
    started_at: '2025-03-01 01:07:35+08',
    completed_at: '2025-03-01 01:07:40+08',
    time_spent_seconds: 5 * 60,
    category: 'Physics Review'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 4,
    started_at: '2025-03-01 01:07:42.393+08',
    completed_at: '2025-03-01 01:07:48.393+08',
    time_spent_seconds: 6 * 60,
    category: 'Chemistry Review'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 5,
    started_at: '2025-03-01 01:07:50.271+08',
    completed_at: '2025-03-01 01:07:55.271+08',
    time_spent_seconds: 5 * 60,
    category: 'Biology Review'
  },
  {
    student_id: '12773012',
    student_name: 'jackie',
    lesson_id: 1,
    started_at: '2025-03-01 01:12:45.871+08',
    completed_at: '2025-03-01 01:12:52.871+08',
    time_spent_seconds: 7 * 60,
    category: 'Advanced Mathematics'
  }
];

export async function GET() {
  try {
    console.log('開始直接插入學習紀錄到 public.learning_records 表...');
    
    // 嘗試直接插入到公共表中
    let { data, error } = await supabase
      .from('learning_records')
      .insert(sampleRecords)
      .select();
    
    if (error) {
      console.error('嘗試插入到 public.learning_records 失敗:', error);
      
      // 如果上面的插入失敗，嘗試插入到帶schema的表中
      console.log('嘗試插入到 learning_records.learning_records...');
      const response = await supabase
        .from('learning_records.learning_records')
        .insert(sampleRecords)
        .select();
      
      data = response.data;
      error = response.error;
      
      if (error) {
        console.error('嘗試插入到 learning_records.learning_records 也失敗:', error);
      }
    }
    
    if (error) {
      return NextResponse.json({ 
        error: '無法插入記錄',
        details: error.message
      }, { status: 500 });
    }
    
    console.log('成功插入學習紀錄');
    return NextResponse.json({ 
      success: true, 
      message: '學習紀錄成功插入', 
      count: sampleRecords.length,
      data
    });
  } catch (error) {
    console.error('插入數據時發生意外錯誤:', error);
    return NextResponse.json({ 
      error: '意外錯誤',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 
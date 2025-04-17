import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// 創建 Supabase 客戶端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 定義參數類型 (使用 Next.js 15.3.0 要求的類型格式)
interface RouteParams {
  id: string;
}

export async function GET(
  request: NextRequest, // Keep NextRequest for consistency if needed, or change to Request if preferred
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const { data: student, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id) // Use the awaited id
      .single();

    if (error) {
      console.error('Error fetching student:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json(student);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest, // Keep NextRequest for consistency if needed, or change to Request if preferred
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const body = await request.json();
    const { data, error } = await supabase
      .from('students')
      .update(body)
      .eq('id', id) // Use the awaited id
      .select()
      .single();

    if (error) {
      console.error('Error updating student:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest, // Keep NextRequest for consistency if needed, or change to Request if preferred
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id); // Use the awaited id

    if (error) {
      console.error('Error deleting student:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

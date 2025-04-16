import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: {
    id: string;
  };
};

// 創建 Supabase 客戶端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { data: student, error } = await supabase
      .from('Student')
      .select('*')
      .eq('id', context.params.id)
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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('Student')
      .update(body)
      .eq('id', params.id)
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase
      .from('Student')
      .delete()
      .eq('id', params.id);

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

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: students, error } = await supabase
      .from('students')
      .select('*')
      .order('name');

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch students' },
        { status: 500 }
      );
    }

    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const json = await request.json();

    const { data: student, error } = await supabase
      .from('students')
      .insert([json])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create student' },
        { status: 500 }
      );
    }

    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
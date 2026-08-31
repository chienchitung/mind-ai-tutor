import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RLS on ai_quiz_attempts restricts rows to those whose quiz is owned by the
// caller, so this never needs its own ownership check beyond that filter.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data, error } = await client.from('ai_quiz_attempts')
      .select('id,student_name,score,total,submitted_at')
      .eq('quiz_id', id)
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
  }
}

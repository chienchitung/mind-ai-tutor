import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Intentionally unauthenticated: this is the link a teacher shares with
// students. get_public_quiz() only returns rows where is_public = true, and
// strips correctAnswer/explanation before they ever leave the database.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 });
    const client = await getServerClient();
    const { data, error } = await client.rpc('get_public_quiz', { p_quiz_id: id });
    if (error) return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
    const quiz = Array.isArray(data) ? data[0] : data;
    if (!quiz) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(quiz, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
  }
}

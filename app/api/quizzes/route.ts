import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { quizPayloadSchema } from '@/lib/quiz';

const columns = 'id,title,questions,created_at,updated_at';

function databaseError(code?: string) {
  const missingMigration = code === '42P01' || code === 'PGRST205';
  return NextResponse.json({ error: missingMigration ? 'QUIZ_STORAGE_NOT_READY' : 'QUIZ_STORAGE_ERROR' }, { status: missingMigration ? 503 : 500 });
}

export async function GET() {
  try {
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data, error } = await client.from('ai_quizzes').select(columns).eq('user_id', user.id).order('updated_at', { ascending: false }).limit(50);
    if (error) return databaseError(error.code);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 1000000) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    let json: unknown;
    try { json = JSON.parse(text); } catch { return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 }); }
    const parsed = quizPayloadSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_QUIZ' }, { status: 400 });
    // Owner always comes from the verified session. RLS also rejects conflicts
    // with a quiz belonging to another user, even if the ID is known.
    const { data, error } = await client.from('ai_quizzes').upsert({
      ...parsed.data, user_id: user.id, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' }).select(columns).single();
    if (error) return databaseError(error.code);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'QUIZ_STORAGE_ERROR' }, { status: 500 });
  }
}

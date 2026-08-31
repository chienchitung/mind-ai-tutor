import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { createSessionSchema, generateJoinCode } from '@/lib/live-session';

function databaseError(code?: string) {
  const missingMigration = code === '42P01' || code === 'PGRST205';
  return NextResponse.json({ error: missingMigration ? 'LIVE_STORAGE_NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: missingMigration ? 503 : 500 });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = createSessionSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    // join_code is unique; retry a handful of times on the rare collision.
    let session: { id: string; join_code: string } | null = null;
    let lastErrorCode: string | undefined;
    for (let attempt = 0; attempt < 5 && !session; attempt++) {
      const { data, error } = await client.from('live_sessions')
        .insert({ user_id: user.id, title: parsed.data.title, join_code: generateJoinCode() })
        .select('id, join_code').single();
      if (!error) { session = data; break; }
      lastErrorCode = error.code;
      if (error.code !== '23505') break;
    }
    if (!session) return databaseError(lastErrorCode);

    const { data: poll, error: pollError } = await client.from('live_polls')
      .insert({ session_id: session.id, question: parsed.data.question, options: parsed.data.options })
      .select('id').single();
    if (pollError || !poll) {
      await client.from('live_sessions').delete().eq('id', session.id);
      return databaseError(pollError?.code);
    }
    const { error: updateError } = await client.from('live_sessions').update({ active_poll_id: poll.id }).eq('id', session.id);
    if (updateError) return databaseError(updateError.code);

    return NextResponse.json(
      { sessionId: session.id, joinCode: session.join_code },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

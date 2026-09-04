import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { pollDraftSchema } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Opens a new poll as the session's active one. The teacher's previous poll
// (if any) stays in live_polls with its votes intact - only the "current"
// pointer moves, nothing is deleted.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = pollDraftSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data: session, error: sessionError } = await client.from('live_sessions')
      .select('id').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (sessionError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!session) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data: poll, error: pollError } = await client.from('live_polls')
      .insert({ session_id: id, question: parsed.data.question, options: parsed.data.options, phase: 'draft' })
      .select('id, question, options').single();
    if (pollError || !poll) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });

    const { error: updateError } = await client.from('live_sessions')
      .update({ active_poll_id: poll.id, updated_at: new Date().toISOString() }).eq('id', id);
    if (updateError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });

    const options = poll.options as string[];
    const payload = { pollId: poll.id, question: poll.question, options, voteCounts: new Array(options.length).fill(0), voteTotal: 0 };
    // See app/api/live-sessions/[id]/route.ts - broadcast never gates the response.
    after(() => broadcastLiveUpdate(id, 'poll:opened', payload)
      .catch((cause) => console.error('live-sessions poll broadcast failed:', cause)));

    return NextResponse.json(payload, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { sessionPatchSchema } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The teacher's own view of their session, including the join code (never
// returned by the public by-code lookup) and the same tally/pulse shape the
// public route sends, so the presenter and audience pages share one state type.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data: session, error: sessionError } = await client.from('live_sessions')
      .select('id, title, status, join_code, active_poll_id, deck_url, deck_page').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (sessionError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!session) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    let poll: { pollId: string; question: string; options: string[]; voteCounts: number[]; voteTotal: number } | null = null;
    if (session.active_poll_id) {
      const { data: pollRow, error: pollError } = await client.from('live_polls')
        .select('id, question, options').eq('id', session.active_poll_id).maybeSingle();
      if (pollError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
      if (pollRow) {
        const { data: tally, error: tallyError } = await client.rpc('get_live_poll_tally', { p_poll_id: pollRow.id });
        if (tallyError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
        const tallyRow = Array.isArray(tally) ? tally[0] : tally;
        poll = {
          pollId: pollRow.id, question: pollRow.question, options: pollRow.options as string[],
          voteCounts: tallyRow?.vote_counts ?? [], voteTotal: tallyRow?.vote_total ?? 0,
        };
      }
    }
    const { data: pulse, error: pulseError } = await client.rpc('get_live_pulse_summary', { p_session_id: id });
    if (pulseError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const pulseRow = Array.isArray(pulse) ? pulse[0] : pulse;

    return NextResponse.json(
      {
        sessionId: session.id, title: session.title, status: session.status, joinCode: session.join_code,
        poll,
        pulse: {
          pulseCounts: pulseRow?.pulse_counts ?? [0, 0, 0, 0, 0],
          pulseTotal: pulseRow?.pulse_total ?? 0,
          pulseAverage: pulseRow?.pulse_average === null || pulseRow?.pulse_average === undefined ? null : Number(pulseRow.pulse_average),
        },
        deckUrl: session.deck_url ?? null,
        deckPage: session.deck_page ?? 1,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = sessionPatchSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.deckUrl !== undefined) update.deck_url = parsed.data.deckUrl;
    if (parsed.data.deckPage !== undefined) update.deck_page = parsed.data.deckPage;

    const { data, error } = await client.from('live_sessions')
      .update(update)
      .eq('id', id).eq('user_id', user.id)
      .select('id, status, deck_url, deck_page').maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    // Scheduled after the response is sent: a slow or hung Realtime connect
    // must never delay the click that triggered it - the write already
    // committed, so the client's own optimistic update is the source of
    // truth for its own action either way. Deck page changes are presenter-
    // only state (the audience never sees the deck), so only a status change
    // is worth broadcasting.
    if (parsed.data.status !== undefined) {
      after(() => broadcastLiveUpdate(id, 'session:status', { status: data.status })
        .catch((cause) => console.error('live-sessions status broadcast failed:', cause)));
    }

    return NextResponse.json(
      { id: data.id, status: data.status, deckUrl: data.deck_url ?? null, deckPage: data.deck_page ?? 1 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

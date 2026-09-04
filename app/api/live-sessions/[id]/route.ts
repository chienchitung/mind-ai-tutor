import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { sessionPatchSchema } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';
import { deleteLiveDeck } from '@/lib/live-deck-storage';

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

    // Poll (+ its tally, once the poll row resolves) and pulse are
    // independent of each other - only the poll fetch itself has an
    // internal two-step dependency (needs the poll row's id before it can
    // ask for the tally). Running the whole poll chain concurrently with
    // pulse instead of after it saves a full round trip on every load.
    type PollResult = { pollId: string; question: string; options: string[]; voteCounts: number[]; voteTotal: number } | null;
    const activePollId = session.active_poll_id;
    const fetchPoll = async (): Promise<{ poll: PollResult } | { errorResponse: NextResponse }> => {
      if (!activePollId) return { poll: null };
      const { data: pollRow, error: pollError } = await client.from('live_polls')
        .select('id, question, options').eq('id', activePollId).maybeSingle();
      if (pollError) return { errorResponse: NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 }) };
      if (!pollRow) return { poll: null };
      const { data: tally, error: tallyError } = await client.rpc('get_live_poll_tally', { p_poll_id: pollRow.id });
      if (tallyError) return { errorResponse: NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 }) };
      const tallyRow = Array.isArray(tally) ? tally[0] : tally;
      return {
        poll: {
          pollId: pollRow.id, question: pollRow.question, options: pollRow.options as string[],
          voteCounts: tallyRow?.vote_counts ?? [], voteTotal: tallyRow?.vote_total ?? 0,
        },
      };
    };
    const [pollResult, { data: pulse, error: pulseError }] = await Promise.all([
      fetchPoll(),
      client.rpc('get_live_pulse_summary', { p_session_id: id }),
    ]);
    if ('errorResponse' in pollResult) return pollResult.errorResponse;
    const poll = pollResult.poll;
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

    // Replacing or clearing the deck orphans whatever file was there before -
    // look it up so it can be cleaned out of Storage once the swap commits.
    let previousDeckUrl: string | null = null;
    if (parsed.data.deckUrl !== undefined) {
      const { data: before } = await client.from('live_sessions')
        .select('deck_url').eq('id', id).eq('user_id', user.id).maybeSingle();
      previousDeckUrl = before?.deck_url ?? null;
    }

    const { data, error } = await client.from('live_sessions')
      .update(update)
      .eq('id', id).eq('user_id', user.id)
      .select('id, status, deck_url, deck_page').maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    if (previousDeckUrl && previousDeckUrl !== data.deck_url) {
      const deckToDelete = previousDeckUrl;
      after(() => deleteLiveDeck(client, deckToDelete).catch((cause) => console.error('live deck cleanup failed:', cause)));
    }

    // Scheduled after the response is sent: a slow or hung Realtime connect
    // must never delay the click that triggered it - the write already
    // committed, so the initiating client's own optimistic update is the
    // source of truth for its own action either way; these broadcasts are
    // for OTHER listeners (the audience page for status, and now the
    // presenter's own read-only projected display window for deck page).
    if (parsed.data.status !== undefined) {
      after(() => broadcastLiveUpdate(id, 'session:status', { status: data.status })
        .catch((cause) => console.error('live-sessions status broadcast failed:', cause)));
    }
    // deckUrl and deckPage always land in the same PATCH in practice (a deck
    // upload/swap/removal resets the page too), so one event carries both -
    // the display window never needs a follow-up fetch to pick up a swap.
    if (parsed.data.deckPage !== undefined) {
      after(() => broadcastLiveUpdate(id, 'deck:sync', { page: data.deck_page, deckUrl: data.deck_url ?? null })
        .catch((cause) => console.error('live-sessions deck sync broadcast failed:', cause)));
    }

    return NextResponse.json(
      { id: data.id, status: data.status, deckUrl: data.deck_url ?? null, deckPage: data.deck_page ?? 1 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

// Delete only a closed session owned by the authenticated teacher. PostgreSQL
// cascades its polls, votes, pulse, questions and question votes atomically.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data: session, error: lookupError } = await client.from('live_sessions')
      .select('id, status, deck_url').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (lookupError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!session) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (session.status !== 'closed') return NextResponse.json({ error: 'SESSION_NOT_CLOSED' }, { status: 409 });
    const { data: deleted, error } = await client.from('live_sessions')
      .delete().eq('id', id).eq('user_id', user.id).eq('status', 'closed').select('id').maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    // Re-check status in the DELETE itself so a concurrent reopen wins safely.
    if (!deleted) return NextResponse.json({ error: 'SESSION_CHANGED' }, { status: 409 });
    after(() => broadcastLiveUpdate(id, 'session:deleted', {})
      .catch(cause => console.error('live session deletion broadcast failed:', cause)));
    if (session.deck_url) {
      const deckToDelete = session.deck_url;
      after(() => deleteLiveDeck(client, deckToDelete).catch((cause) => console.error('live deck cleanup failed:', cause)));
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

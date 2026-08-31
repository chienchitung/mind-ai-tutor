import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { voteSchema } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const codePattern = /^[0-9]{6}$/;
const knownErrors = ['SESSION_NOT_OPEN', 'POLL_NOT_ACTIVE', 'INVALID_OPTION', 'POLL_NOT_FOUND', 'INVALID_PARTICIPANT'];

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { code } = await params;
    if (!codePattern.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = voteSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const client = await getServerClient();
    const { data: lookup, error: lookupError } = await client.rpc('get_live_session_by_code', { p_code: code });
    if (lookupError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const row = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!row?.active_poll_id) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data, error } = await client.rpc('cast_live_poll_vote', {
      p_poll_id: row.active_poll_id,
      p_participant_id: parsed.data.participantId,
      p_option_index: parsed.data.optionIndex,
    });
    if (error) {
      const known = knownErrors.find((code) => error.message?.includes(code));
      return NextResponse.json({ error: known || 'LIVE_STORAGE_ERROR' }, { status: known ? 409 : 500 });
    }
    const result = Array.isArray(data) ? data[0] : data;

    try {
      await broadcastLiveUpdate(row.session_id, 'poll:tally', {
        pollId: row.active_poll_id, voteCounts: result.vote_counts, voteTotal: result.vote_total,
      });
    } catch (cause) { console.error('live vote broadcast failed:', cause); }

    return NextResponse.json(
      { voteCounts: result.vote_counts, voteTotal: result.vote_total },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { questionUpvoteSchema } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const codePattern = /^[0-9]{6}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const knownErrors = ['SESSION_NOT_OPEN', 'QUESTION_NOT_FOUND', 'INVALID_PARTICIPANT'];

export async function POST(request: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { code, id } = await params;
    if (!codePattern.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_QUESTION' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = questionUpvoteSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const client = await getServerClient();
    const { data: lookup, error: lookupError } = await client.rpc('get_live_session_by_code', { p_code: code });
    if (lookupError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const row = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data, error } = await client.rpc('upvote_live_question', {
      p_question_id: id,
      p_participant_id: parsed.data.participantId,
    });
    if (error) {
      const known = knownErrors.find((errCode) => error.message?.includes(errCode));
      const status = known === 'QUESTION_NOT_FOUND' ? 404 : known ? 409 : 500;
      return NextResponse.json({ error: known || 'LIVE_STORAGE_ERROR' }, { status });
    }
    const result = Array.isArray(data) ? data[0] : data;

    // See app/api/live-sessions/[id]/route.ts - broadcast never gates the response.
    after(() => broadcastLiveUpdate(row.session_id, 'question:upvote', {
      questionId: id, upvotes: result.upvotes,
    }).catch((cause) => console.error('live question upvote broadcast failed:', cause)));

    return NextResponse.json(
      { questionId: id, upvotes: result.upvotes },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

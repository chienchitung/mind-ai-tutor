import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { questionSubmitSchema, mapQuestionRow } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const codePattern = /^[0-9]{6}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public: 'public' questions for everyone, plus the caller's own regardless
// of visibility (so an author sees their own question was hidden).
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    if (!codePattern.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    const participantId = new URL(request.url).searchParams.get('participantId');
    if (participantId && !uuid.test(participantId)) return NextResponse.json({ error: 'INVALID_PARTICIPANT' }, { status: 400 });

    const client = await getServerClient();
    const { data: lookup, error: lookupError } = await client.rpc('get_live_session_by_code', { p_code: code });
    if (lookupError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const row = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data, error } = await client.rpc('get_live_questions', { p_session_id: row.session_id, p_participant_id: participantId });
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    return NextResponse.json((data ?? []).map(mapQuestionRow), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { code } = await params;
    if (!codePattern.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = questionSubmitSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const client = await getServerClient();
    const { data: lookup, error: lookupError } = await client.rpc('get_live_session_by_code', { p_code: code });
    if (lookupError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const row = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data, error } = await client.rpc('submit_live_question', {
      p_session_id: row.session_id, p_participant_id: parsed.data.participantId, p_text: parsed.data.text, p_lens: parsed.data.lens,
    });
    if (error) {
      const known = ['SESSION_NOT_OPEN', 'SESSION_NOT_FOUND', 'INVALID_TEXT', 'INVALID_LENS', 'INVALID_PARTICIPANT'];
      const matched = known.find((code2) => error.message?.includes(code2));
      return NextResponse.json({ error: matched || 'LIVE_STORAGE_ERROR' }, { status: matched ? 409 : 500 });
    }
    const question = mapQuestionRow(Array.isArray(data) ? data[0] : data);

    after(() => broadcastLiveUpdate(row.session_id, 'question:new', { ...question })
      .catch((cause) => console.error('live question broadcast failed:', cause)));

    return NextResponse.json(question, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

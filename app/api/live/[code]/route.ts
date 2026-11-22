import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { mapSessionByCodeRow } from '@/lib/live-session';

const codePattern = /^[0-9]{6}$/;

// Intentionally unauthenticated: this is the code/QR a teacher shows on the
// presenter screen. get_live_session_by_code() strips nothing sensitive -
// there's no answer key concept for an opinion poll - it just resolves the
// code to the session's current public state.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    if (!codePattern.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    const client = await getServerClient();
    const [{ data, error }, recording, sharesDeck] = await Promise.all([
      client.rpc('get_live_session_by_code', { p_code: code }),
      client.rpc('is_live_session_recording', { p_code: code }),
      client.rpc('live_session_shares_deck', { p_code: code }),
    ]);
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    // Missing until the recording-notice migration runs: no notice, not an error.
    const session = mapSessionByCodeRow(row);
    // Once the class has ended the slides stay with the teacher unless they
    // chose to share them.
    const deckUrl = session.status === 'closed' && !(!sharesDeck.error && sharesDeck.data === true) ? null : session.deckUrl;
    return NextResponse.json(
      { ...session, deckUrl, recording: !recording.error && recording.data === true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

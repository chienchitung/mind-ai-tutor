import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
import { reactionSchema } from '@/lib/live-session';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';

const codePattern = /^[0-9]{6}$/;

// Phase 3 reactions need no table - like call-in's own reaction stream,
// they're ephemeral pulses broadcast straight to whoever's watching, never
// persisted. This route only validates the session is open, then broadcasts.
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { code } = await params;
    if (!codePattern.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = reactionSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });

    const client = await getServerClient();
    const { data: lookup, error: lookupError } = await client.rpc('get_live_session_by_code', { p_code: code });
    if (lookupError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const row = Array.isArray(lookup) ? lookup[0] : lookup;
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (row.status !== 'open') return NextResponse.json({ error: 'SESSION_NOT_OPEN' }, { status: 409 });

    after(() => broadcastLiveUpdate(row.session_id, 'reaction:sent', { kind: parsed.data.kind })
      .catch((cause) => console.error('live reaction broadcast failed:', cause)));

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';
import { applyTimerAction, readTimer, timerActionSchema } from '@/lib/live-timer';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store' };
// Undefined column: the timer migration has not run yet.
const notReady = (code?: string) => code === '42703' || code === 'PGRST204';

async function ownerSession(id: string) {
  const client = await getServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  return { client, user: error ? null : user };
}

// Teacher-only: the class timer, with the server's time so the page can
// correct for its own clock.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    const { client, user } = await ownerSession(id);
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data, error } = await client.from('live_sessions').select('timer').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (error) return NextResponse.json({ error: notReady(error.code) ? 'NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: notReady(error.code) ? 503 : 500, headers });
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ timer: readTimer(data.timer), serverNow: Date.now() }, { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

// Start, pause, reset, set the length of, nudge or hide the class timer.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    const parsed = timerActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const { client, user } = await ownerSession(id);
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { data: current, error: readError } = await client.from('live_sessions').select('timer').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (readError) return NextResponse.json({ error: notReady(readError.code) ? 'NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: notReady(readError.code) ? 503 : 500, headers });
    if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const now = Date.now();
    const timer = applyTimerAction(readTimer(current.timer), parsed.data, now);
    const { data: saved, error } = await client.from('live_sessions')
      .update({ timer, updated_at: new Date(now).toISOString() })
      .eq('id', id).eq('user_id', user.id)
      .select('id').maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!saved) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const payload = { timer, serverNow: now };
    after(() => broadcastLiveUpdate(id, 'timer:update', payload)
      .catch((cause) => console.error('live timer broadcast failed:', cause)));
    return NextResponse.json(payload, { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { preparedPollSchema, preparedPollsSchema, type PreparedPoll } from '@/lib/live-session';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store' };

// Undefined column: the prepared-polls migration has not run yet.
const notReady = (code?: string) => code === '42703' || code === 'PGRST204';

function readPolls(value: unknown): PreparedPoll[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = preparedPollSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

async function owner() {
  const client = await getServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  return { client, user: error ? null : user };
}

// Teacher-only: the poll questions set up for this session ahead of class.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    const { client, user } = await owner();
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data, error } = await client.from('live_sessions')
      .select('prepared_polls').eq('id', id).eq('user_id', user.id).maybeSingle();
    if (error) {
      if (notReady(error.code)) return NextResponse.json({ error: 'NOT_READY' }, { status: 503, headers });
      return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ polls: readPolls(data.prepared_polls) }, { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

// Replaces the whole list (it is short, and only its owner edits it).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_SESSION' }, { status: 400 });
    let json: unknown;
    try { json = await request.json(); } catch { return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }); }
    const parsed = preparedPollsSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const { client, user } = await owner();
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data, error } = await client.from('live_sessions')
      .update({ prepared_polls: parsed.data.polls, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)
      .select('prepared_polls').maybeSingle();
    if (error) {
      if (notReady(error.code)) return NextResponse.json({ error: 'NOT_READY' }, { status: 503, headers });
      return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ polls: readPolls(data.prepared_polls) }, { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

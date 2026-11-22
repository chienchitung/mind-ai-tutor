import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { readTimer } from '@/lib/live-timer';

const headers = { 'Cache-Control': 'private, no-store' };

// Public, by join code: the class timer (and nothing else), with the
// server's time so a student's phone counts toward the same end.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    if (!/^[0-9]{6}$/.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
    const client = await getServerClient();
    const { data, error } = await client.rpc('get_live_timer', { p_code: code });
    // Missing until the timer migration runs: no timer, not an error.
    if (error) return NextResponse.json({ timer: null, serverNow: Date.now() }, { headers });
    return NextResponse.json({ timer: readTimer(data), serverNow: Date.now() }, { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

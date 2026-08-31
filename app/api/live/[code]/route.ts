import { NextResponse } from 'next/server';
import { getServerClient } from '@/app/lib/supabase';
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
    const { data, error } = await client.rpc('get_live_session_by_code', { p_code: code });
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(mapSessionByCodeRow(row), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

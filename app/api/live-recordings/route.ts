import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { createRecordingSchema } from '@/lib/live-recording';
import { authorizeTeacherAi } from '../gemini/security';

const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The owner's recordings for one session, newest first, with per-segment
// transcription state so the panel can show progress and retry failures.
export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get('sessionId') ?? '';
    if (!uuid.test(sessionId)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const { data, error } = await client.from('live_recordings')
      .select('id, title, status, duration_seconds, notes_generated_at, created_at, live_recording_segments(idx, status)')
      .eq('user_id', user.id).eq('session_id', sessionId)
      .order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.code === '42P01' ? 'RECORDINGS_NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: error.code === '42P01' ? 503 : 500 });
    return NextResponse.json((data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      durationSeconds: row.duration_seconds,
      hasNotes: !!row.notes_generated_at,
      createdAt: row.created_at,
      transcribed: (row.live_recording_segments ?? []).filter((segment: any) => segment.status === 'transcribed').length,
      failed: (row.live_recording_segments ?? []).filter((segment: any) => segment.status === 'failed').length,
    })), { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await authorizeTeacherAi(request);
    if (access.response) return access.response;
    const parsed = createRecordingSchema.safeParse(await readJsonWithLimit(request, 10_000));
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = access.client!;
    const userId = access.user!.id;
    const { data: session, error: sessionError } = await client.from('live_sessions')
      .select('id').eq('id', parsed.data.sessionId).eq('user_id', userId).maybeSingle();
    if (sessionError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!session) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const { data, error } = await client.from('live_recordings')
      .insert({ user_id: userId, session_id: session.id, title: parsed.data.title })
      .select('id, title, status, created_at').single();
    if (error) return NextResponse.json({ error: error.code === '42P01' ? 'RECORDINGS_NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: error.code === '42P01' ? 503 : 500 });
    return NextResponse.json({ id: data.id, title: data.title, status: data.status, createdAt: data.created_at, userId }, { status: 201, headers });
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

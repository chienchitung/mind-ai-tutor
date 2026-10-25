import { NextResponse, after } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { createRecordingSchema, isRecordingActive, type RecordingSummary } from '@/lib/live-recording';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';
import { authorizeTeacherAi } from '../gemini/security';

const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The owner's recordings, newest first: for one session (the workspace
// panel) or all of them (the recordings overview), with per-segment
// transcription state so the list can show progress and retry failures.
export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get('sessionId');
    if (sessionId !== null && !uuid.test(sessionId)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    let query = client.from('live_recordings')
      .select('id, session_id, title, status, duration_seconds, notes_generated_at, created_at, updated_at, live_sessions(title, deck_url), live_recording_segments(idx, status)')
      .eq('user_id', user.id);
    if (sessionId) query = query.eq('session_id', sessionId);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(sessionId ? 50 : 300);
    if (error) return NextResponse.json({ error: error.code === '42P01' ? 'RECORDINGS_NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: error.code === '42P01' ? 503 : 500 });
    const now = Date.now();
    const recordings: RecordingSummary[] = (data ?? []).map((row: any) => {
      const session = Array.isArray(row.live_sessions) ? row.live_sessions[0] : row.live_sessions;
      const segments: { status: string }[] = row.live_recording_segments ?? [];
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        active: isRecordingActive(row.status, row.updated_at, now),
        durationSeconds: row.duration_seconds,
        hasNotes: !!row.notes_generated_at,
        createdAt: row.created_at,
        sessionId: row.session_id ?? null,
        sessionTitle: session?.title ?? null,
        deckUrl: session?.deck_url ?? null,
        transcribed: segments.filter((segment) => segment.status === 'transcribed').length,
        failed: segments.filter((segment) => segment.status === 'failed').length,
      };
    });
    return NextResponse.json(recordings, { headers });
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
    // Students' pages show a "the teacher is recording" notice.
    after(() => broadcastLiveUpdate(session.id, 'recording:state', { active: true })
      .catch((cause) => console.error('recording start broadcast failed:', cause)));
    return NextResponse.json({ id: data.id, title: data.title, status: data.status, createdAt: data.created_at, userId }, { status: 201, headers });
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

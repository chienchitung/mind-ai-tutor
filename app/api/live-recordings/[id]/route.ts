import { NextResponse, after } from 'next/server';
import { broadcastLiveUpdate } from '@/lib/live-broadcast';
import { getServerClient } from '@/lib/supabase-server';
import { isSameOriginRequest, HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { RECORDING_ACTIVE_WINDOW_MS, RECORDING_BUCKET, updateRecordingSchema } from '@/lib/live-recording';

const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Clears the students' "the teacher is recording" notice - unless another
// recording of the same session is still live (e.g. a second tab).
function endNotice(client: Awaited<ReturnType<typeof getServerClient>>, sessionId: string, endedId: string) {
  after(async () => {
    const since = new Date(Date.now() - RECORDING_ACTIVE_WINDOW_MS).toISOString();
    const { data: others } = await client.from('live_recordings')
      .select('id').eq('session_id', sessionId).eq('status', 'recording').neq('id', endedId).gt('updated_at', since).limit(1);
    if (others?.length) return;
    await broadcastLiveUpdate(sessionId, 'recording:state', { active: false })
      .catch((cause) => console.error('recording stop broadcast failed:', cause));
  });
}

async function owner(request: Request, params: Promise<{ id: string }>, mutating: boolean) {
  if (mutating && !isSameOriginRequest(request)) return { response: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  const { id } = await params;
  if (!uuid.test(id)) return { response: NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 }) };
  const client = await getServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
  return { id, client, user };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await owner(request, params, false);
    if (ctx.response) return ctx.response;
    const { data, error } = await ctx.client.from('live_recordings')
      .select('id, session_id, title, status, duration_seconds, slide_marks, notes, notes_generated_at, created_at, live_recording_segments(idx, start_seconds, duration_seconds, status, transcript, error)')
      .eq('id', ctx.id).eq('user_id', ctx.user.id).maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const segments = ((data as any).live_recording_segments ?? [])
      .map((segment: any) => ({
        idx: segment.idx, startSeconds: segment.start_seconds, durationSeconds: segment.duration_seconds,
        status: segment.status, transcript: segment.transcript, error: segment.error,
      }))
      .sort((a: { idx: number }, b: { idx: number }) => a.idx - b.idx);
    return NextResponse.json({
      id: data.id, sessionId: data.session_id, title: data.title, status: data.status,
      durationSeconds: data.duration_seconds, slideMarks: data.slide_marks ?? [],
      notes: data.notes, notesGeneratedAt: data.notes_generated_at, createdAt: data.created_at, segments,
      // Where the lesson audio lives: <userId>/<id>/lecture-audio.
      userId: ctx.user.id,
    }, { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await owner(request, params, true);
    if (ctx.response) return ctx.response;
    const parsed = updateRecordingSchema.safeParse(await readJsonWithLimit(request, 200_000));
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.status) update.status = parsed.data.status;
    if (parsed.data.durationSeconds !== undefined) update.duration_seconds = parsed.data.durationSeconds;
    if (parsed.data.slideMarks) update.slide_marks = parsed.data.slideMarks;
    const { data, error } = await ctx.client.from('live_recordings')
      .update(update).eq('id', ctx.id).eq('user_id', ctx.user.id).select('id, session_id').maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (parsed.data.status === 'stopped' && data.session_id) endNotice(ctx.client, data.session_id, ctx.id);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

// Removes the recording, its transcript and notes, and any audio segment
// still waiting in Storage (transcribed segments are already deleted).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await owner(request, params, true);
    if (ctx.response) return ctx.response;
    const folder = `${ctx.user.id}/${ctx.id}`;
    const bucket = ctx.client.storage.from(RECORDING_BUCKET);
    const { data: files } = await bucket.list(folder, { limit: 300 });
    if (files?.length) {
      const { error: removeError } = await bucket.remove(files.map((file) => `${folder}/${file.name}`));
      if (removeError) return NextResponse.json({ error: 'RECORDING_DELETE' }, { status: 500 });
    }
    const { data, error } = await ctx.client.from('live_recordings')
      .delete().eq('id', ctx.id).eq('user_id', ctx.user.id).select('id, session_id, status').maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (data.status === 'recording' && data.session_id) endNotice(ctx.client, data.session_id, ctx.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

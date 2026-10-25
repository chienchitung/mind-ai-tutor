import { NextResponse } from 'next/server';
import { transcribeLectureAudio } from '@/lib/gemini';
import { HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { RECORDING_BUCKET, segmentPath, segmentSchema, timedTranscript, transcriptParagraphs } from '@/lib/live-recording';
import { aiFailure, authorizeTeacherAi, claimTeacherAi } from '../../../gemini/security';

export const runtime = 'nodejs';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Transcribes one segment the presenter's browser already uploaded to
// live-recordings/<owner>/<recording>/<idx>.wav, stores the text and deletes
// the audio. Idempotent: a segment already transcribed is returned as-is
// without spending points, so the client can safely retry after a timeout.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeTeacherAi(request);
    if (access.response) return access.response;
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const parsed = segmentSchema.safeParse(await readJsonWithLimit(request, 2_000));
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = access.client!;
    const userId = access.user!.id;
    const { idx, startSeconds, durationSeconds, language } = parsed.data;

    const { data: recording, error: recordingError } = await client.from('live_recordings')
      .select('id').eq('id', id).eq('user_id', userId).maybeSingle();
    if (recordingError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!recording) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data: existing } = await client.from('live_recording_segments')
      .select('idx, status, transcript').eq('recording_id', id).eq('idx', idx).maybeSingle();
    const path = segmentPath(userId, id, idx);
    const bucket = client.storage.from(RECORDING_BUCKET);
    if (existing?.status === 'transcribed') {
      // A retry after a lost response (e.g. crash recovery) may have uploaded
      // the audio again; audio never stays once its text is saved.
      await bucket.remove([path]).catch(() => undefined);
      return NextResponse.json({ idx, status: 'transcribed', transcript: existing.transcript }, { headers });
    }

    const { data: audio, error: downloadError } = await bucket.download(path);
    if (downloadError || !audio) return NextResponse.json({ error: 'SEGMENT_NOT_UPLOADED' }, { status: 409 });

    const quota = await claimTeacherAi(client, 'transcription');
    if (quota) return quota;

    const { data: previous } = idx > 0
      ? await client.from('live_recording_segments').select('start_seconds, transcript').eq('recording_id', id).eq('idx', idx - 1).maybeSingle()
      : { data: null };
    const previousText = previous
      ? transcriptParagraphs({ startSeconds: previous.start_seconds ?? 0, transcript: previous.transcript }).map((paragraph) => paragraph.text).join(' ')
      : '';
    const previousTail = previousText ? previousText.slice(-300) : undefined;

    const row = { recording_id: id, idx, user_id: userId, start_seconds: startSeconds, duration_seconds: durationSeconds, updated_at: new Date().toISOString() };
    let transcript: string;
    try {
      const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64');
      const paragraphs = await transcribeLectureAudio(base64, { language, previousTail });
      transcript = timedTranscript(paragraphs, startSeconds, durationSeconds).slice(0, 60_000);
    } catch (error) {
      // Keep the audio so a retry can transcribe it again.
      await client.from('live_recording_segments').upsert({ ...row, status: 'failed', transcript: null, error: 'TRANSCRIPTION_FAILED' });
      return aiFailure(error);
    }
    const { error: saveError } = await client.from('live_recording_segments')
      .upsert({ ...row, status: 'transcribed', transcript, error: null });
    if (saveError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    const { error: removeError } = await bucket.remove([path]);
    if (removeError) console.error('transcribed segment audio cleanup failed:', removeError);
    return NextResponse.json({ idx, status: 'transcribed', transcript }, { headers });
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

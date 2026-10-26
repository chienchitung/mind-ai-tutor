import { NextResponse } from 'next/server';
import { generateLectureNotes } from '@/lib/gemini';
import { HttpInputError, readJsonWithLimit } from '@/lib/http-security';
import { formatClock, joinTranscript, notesRequestSchema, slideTimeline, type RecordingSegment, type SlideMark } from '@/lib/live-recording';
import { aiFailure, authorizeTeacherAi, claimTeacherAi } from '../../../gemini/security';

export const runtime = 'nodejs';
export const maxDuration = 60;

const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TRANSCRIPT_CHARS = 120_000;
// Below this much actual speech there is nothing to make notes from; the AI
// would only paraphrase the deck.
const MIN_SPOKEN_CHARS = 40;

// Builds teaching notes from the stored transcript, the slide timeline
// recorded alongside it, the slide text the browser extracted from the deck,
// and the questions students posted in that session.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await authorizeTeacherAi(request);
    if (access.response) return access.response;
    const { id } = await params;
    if (!uuid.test(id)) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const parsed = notesRequestSchema.safeParse(await readJsonWithLimit(request, 400_000));
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = access.client!;
    const userId = access.user!.id;

    const { data: recording, error } = await client.from('live_recordings')
      .select('id, session_id, title, duration_seconds, slide_marks, live_recording_segments(idx, start_seconds, duration_seconds, status, transcript, error)')
      .eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    if (!recording) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const segments: RecordingSegment[] = ((recording as any).live_recording_segments ?? []).map((segment: any) => ({
      idx: segment.idx, startSeconds: segment.start_seconds, durationSeconds: segment.duration_seconds,
      status: segment.status, transcript: segment.transcript, error: segment.error,
    }));
    const transcript = joinTranscript(segments);
    if (!transcript) return NextResponse.json({ error: 'NO_TRANSCRIPT' }, { status: 409 });
    const spoken = transcript.replace(/\[(?:\d+:)?\d{1,2}:\d{2}\]/g, '').replace(/\s+/g, '');
    if (spoken.length < MIN_SPOKEN_CHARS) return NextResponse.json({ error: 'TRANSCRIPT_TOO_SHORT' }, { status: 409 });

    let studentQuestions: string[] = [];
    if (recording.session_id) {
      const { data: questions } = await client.rpc('get_live_questions_for_owner', { p_session_id: recording.session_id });
      studentQuestions = (Array.isArray(questions) ? questions : [])
        .filter((question: any) => question.visibility === 'public')
        .map((question: any) => String(question.text).slice(0, 600))
        .slice(0, 40);
    }

    const quota = await claimTeacherAi(client, 'lesson_notes');
    if (quota) return quota;

    const duration = recording.duration_seconds || segments.reduce((sum, segment) => Math.max(sum, segment.startSeconds + segment.durationSeconds), 0);
    const timeline = slideTimeline((recording.slide_marks ?? []) as SlideMark[], duration);
    // Only the slides that were actually on screen while recording: handing
    // over the whole deck let a few seconds of speech come back as notes for
    // the entire deck.
    const shown = new Set(timeline.map((range) => range.page));
    let notes;
    try {
      notes = await generateLectureNotes({
        language: parsed.data.language,
        title: recording.title,
        transcript: transcript.slice(0, MAX_TRANSCRIPT_CHARS),
        slideTimeline: timeline.map((range) => ({ page: range.page, from: formatClock(range.from), to: formatClock(range.to) })),
        slides: parsed.data.slides.filter((slide) => slide.text.trim() && shown.has(slide.page)),
        studentQuestions,
      });
    } catch (cause) {
      return aiFailure(cause);
    }
    const generatedAt = new Date().toISOString();
    const { error: saveError } = await client.from('live_recordings')
      // updated_at is left alone: it is the recorder's heartbeat, and bumping
      // it here would make an abandoned recording look live again.
      .update({ notes, notes_generated_at: generatedAt })
      .eq('id', id).eq('user_id', userId);
    if (saveError) return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
    return NextResponse.json({ notes, notesGeneratedAt: generatedAt }, { headers });
  } catch (error) {
    if (error instanceof HttpInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

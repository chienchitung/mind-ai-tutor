import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';
import { findRecordingMatch, type RecordingMatch } from '@/lib/live-recording';

const headers = { 'Cache-Control': 'private, no-store' };
const MAX_QUERY = 100;

// Escapes LIKE wildcards so the teacher's text is matched literally.
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;

// Finds the owner's recordings whose transcript or teaching notes mention the
// query, with a short excerpt (and, for transcripts, the paragraph's time)
// so the overview can show where it was said.
export async function GET(request: Request) {
  try {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
    if (!q || q.length > MAX_QUERY) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    const client = await getServerClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const [segments, notes] = await Promise.all([
      client.from('live_recording_segments')
        .select('recording_id, idx, transcript')
        .eq('user_id', user.id)
        .ilike('transcript', likePattern(q))
        .order('idx', { ascending: true })
        .limit(300),
      // Notes are JSON, so they are matched here rather than in SQL.
      client.from('live_recordings')
        .select('id, notes')
        .eq('user_id', user.id)
        .not('notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);
    if (segments.error || notes.error) {
      const missing = segments.error?.code === '42P01' || notes.error?.code === '42P01';
      return NextResponse.json({ error: missing ? 'RECORDINGS_NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: missing ? 503 : 500 });
    }

    const matches: Record<string, RecordingMatch> = {};
    // Segments come in order, so the first hit per recording is the earliest.
    for (const row of segments.data ?? []) {
      if (matches[row.recording_id]) continue;
      const match = findRecordingMatch(row.transcript ?? '', q, 'transcript');
      if (match) matches[row.recording_id] = match;
    }
    for (const row of notes.data ?? []) {
      if (matches[row.id]) continue;
      const match = findRecordingMatch(notesText(row.notes), q, 'notes');
      if (match) matches[row.id] = match;
    }
    return NextResponse.json(matches, { headers });
  } catch {
    return NextResponse.json({ error: 'LIVE_STORAGE_ERROR' }, { status: 500 });
  }
}

// Every string in the notes, in reading order, one per line.
function notesText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(notesText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(notesText).filter(Boolean).join('\n');
  return '';
}

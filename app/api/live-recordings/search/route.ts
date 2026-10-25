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

    const [hits, notes] = await Promise.all([
      firstTranscriptHits(client, user.id, q),
      // Notes are JSON, so they are matched here rather than in SQL.
      client.from('live_recordings')
        .select('id, notes')
        .eq('user_id', user.id)
        .not('notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);
    if (hits.error || notes.error) {
      const missing = hits.error?.code === '42P01' || notes.error?.code === '42P01';
      return NextResponse.json({ error: missing ? 'RECORDINGS_NOT_READY' : 'LIVE_STORAGE_ERROR' }, { status: missing ? 503 : 500 });
    }

    const matches: Record<string, RecordingMatch> = {};
    for (const row of hits.rows) {
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

const HIT_PAGE = 1000;
const HIT_PAGES = 10;
const TEXT_BATCH = 40;

// The earliest matching paragraph of every recording that mentions `q`.
// Hits are listed first without their text and de-duplicated per recording
// before anything is capped, so a lecture that says the word fifty times
// cannot crowd out one that says it once; only those first paragraphs'
// text is then read.
async function firstTranscriptHits(client: Awaited<ReturnType<typeof getServerClient>>, userId: string, q: string) {
  const first = new Map<string, number>();
  for (let page = 0; page < HIT_PAGES; page++) {
    const { data, error } = await client.from('live_recording_segments')
      .select('recording_id, idx')
      .eq('user_id', userId)
      .ilike('transcript', likePattern(q))
      .order('recording_id', { ascending: true })
      .order('idx', { ascending: true })
      .range(page * HIT_PAGE, page * HIT_PAGE + HIT_PAGE - 1);
    if (error) return { error, rows: [] };
    for (const row of data ?? []) if (!first.has(row.recording_id)) first.set(row.recording_id, row.idx);
    if ((data ?? []).length < HIT_PAGE) break;
  }
  const rows: { recording_id: string; idx: number; transcript: string | null }[] = [];
  const ids = Array.from(first.keys());
  for (let start = 0; start < ids.length; start += TEXT_BATCH) {
    const batch = ids.slice(start, start + TEXT_BATCH);
    const { data, error } = await client.from('live_recording_segments')
      .select('recording_id, idx, transcript')
      .eq('user_id', userId)
      .in('recording_id', batch)
      .in('idx', Array.from(new Set(batch.map((id) => first.get(id)!))));
    if (error) return { error, rows: [] };
    // The two lists cross; keep only each recording's own first paragraph.
    rows.push(...(data ?? []).filter((row) => first.get(row.recording_id) === row.idx));
  }
  return { error: null, rows };
}

// Every string in the notes, in reading order, one per line.
function notesText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(notesText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(notesText).filter(Boolean).join('\n');
  return '';
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerClient: vi.fn(),
  authorizeTeacherAi: vi.fn(),
  broadcastLiveUpdate: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ getServerClient: mocks.getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate: mocks.broadcastLiveUpdate }));
vi.mock('../gemini/security', () => ({ authorizeTeacherAi: mocks.authorizeTeacherAi }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));

import { GET, POST } from './route';

const owner = '00000000-0000-4000-8000-000000000001';
const sessionId = '60000000-0000-4000-8000-000000000001';
let rows: any[];
let filters: Record<string, unknown>;
let inserted: any;

function table(name: string) {
  const chain: any = {
    select: () => chain,
    eq: (column: string, value: unknown) => { filters[`${name}.${column}`] = value; return chain; },
    order: () => chain,
    limit: async () => ({ data: rows, error: null }),
    maybeSingle: async () => ({ data: name === 'live_sessions' ? { id: sessionId } : null, error: null }),
    insert: (row: any) => { inserted = row; return chain; },
    single: async () => ({ data: { id: 'rec-1', title: inserted.title, status: 'recording', created_at: '2026-10-25T00:00:00Z' }, error: null }),
  };
  return chain;
}

beforeEach(() => {
  filters = {};
  inserted = null;
  mocks.broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: owner } }, error: null }) }, from: table };
  mocks.getServerClient.mockResolvedValue(client);
  mocks.authorizeTeacherAi.mockResolvedValue({ client, user: { id: owner } });
  const fresh = new Date(Date.now() - 60_000).toISOString();
  const stale = new Date(Date.now() - 30 * 60_000).toISOString();
  rows = [
    { id: 'a', session_id: sessionId, title: '第三課', status: 'recording', duration_seconds: 120, notes_generated_at: null, created_at: '2026-10-25T01:00:00Z', updated_at: fresh, live_sessions: { title: '第三課：IF', deck_url: 'https://deck.test/a.pdf' }, live_recording_segments: [{ idx: 0, status: 'transcribed' }] },
    { id: 'b', session_id: null, title: '第二課', status: 'recording', duration_seconds: 900, notes_generated_at: '2026-10-20T00:00:00Z', created_at: '2026-10-20T01:00:00Z', updated_at: stale, live_sessions: null, live_recording_segments: [{ idx: 0, status: 'transcribed' }, { idx: 1, status: 'failed' }] },
  ];
});

describe('GET /api/live-recordings', () => {
  it('lists every recording with its session, and tells a live one from one whose tab closed without stopping', async () => {
    const response = await GET(new Request('https://test.local/api/live-recordings'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: 'a', title: '第三課', status: 'recording', active: true, durationSeconds: 120, hasNotes: false, createdAt: '2026-10-25T01:00:00Z', sessionId, sessionTitle: '第三課：IF', deckUrl: 'https://deck.test/a.pdf', transcribed: 1, failed: 0 },
      { id: 'b', title: '第二課', status: 'recording', active: false, durationSeconds: 900, hasNotes: true, createdAt: '2026-10-20T01:00:00Z', sessionId: null, sessionTitle: null, deckUrl: null, transcribed: 1, failed: 1 },
    ]);
    expect(filters).toEqual({ 'live_recordings.user_id': owner });
  });
  it('narrows to one session for the workspace panel and rejects a malformed id', async () => {
    await GET(new Request(`https://test.local/api/live-recordings?sessionId=${sessionId}`));
    expect(filters).toEqual({ 'live_recordings.user_id': owner, 'live_recordings.session_id': sessionId });
    expect((await GET(new Request('https://test.local/api/live-recordings?sessionId=nope'))).status).toBe(400);
  });
});

describe('POST /api/live-recordings', () => {
  it('starts a recording and tells the session\'s students it is being recorded', async () => {
    const response = await POST(new Request('https://test.local/api/live-recordings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://test.local' },
      body: JSON.stringify({ sessionId, title: '第三課' }),
    }));
    expect(response.status).toBe(201);
    expect(inserted).toMatchObject({ user_id: owner, session_id: sessionId, title: '第三課' });
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith(sessionId, 'recording:state', { active: true });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeTeacherAi: vi.fn(),
  claimTeacherAi: vi.fn(),
  generateLectureNotes: vi.fn(),
}));
vi.mock('../../../gemini/security', () => ({
  authorizeTeacherAi: mocks.authorizeTeacherAi,
  claimTeacherAi: mocks.claimTeacherAi,
  aiFailure: () => new Response(JSON.stringify({ error: 'AI_FAILED' }), { status: 502 }),
}));
vi.mock('@/lib/gemini', () => ({ generateLectureNotes: mocks.generateLectureNotes }));

import { POST } from './route';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '11111111-1111-4111-8111-111111111111';
const notes = { title: 't', summary: 's', sections: [{ heading: 'h', slidePages: [1], startSeconds: 0, points: ['p'], examples: [] }], keyTerms: [], studentQuestions: [], reviewQuestions: [] };
let recording: any;
let updates: any[];
let rpc: ReturnType<typeof vi.fn>;

function table() {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: recording, error: null }),
    update: (row: any) => { updates.push(row); return chain; },
    then: (resolve: (value: unknown) => void) => resolve({ error: null }),
  };
  return chain;
}

const request = (body: unknown = {}) => new Request(`https://test.local/api/live-recordings/${id}/notes`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://test.local' }, body: JSON.stringify(body),
});
const params = () => Promise.resolve({ id });

beforeEach(() => {
  updates = [];
  recording = {
    id, session_id: '22222222-2222-4222-8222-222222222222', title: '第三課', duration_seconds: 400,
    live_sessions: { deck_url: 'https://cdn.test/deck-v1.pdf' },
    slide_marks: [{ t: 0, page: 1 }, { t: 120, page: 2 }],
    live_recording_segments: [
      { idx: 1, start_seconds: 300, duration_seconds: 100, status: 'transcribed', transcript: '接著示範巢狀 IF，再用 VLOOKUP 把成績對照到等第，記得第四個參數填 FALSE', error: null },
      { idx: 0, start_seconds: 0, duration_seconds: 300, status: 'transcribed', transcript: '今天先介紹 IF 函數的語法，第一個參數是條件，第二個是成立時的結果', error: null },
    ],
  };
  rpc = vi.fn().mockResolvedValue({ data: [{ text: '公開提問', visibility: 'public' }, { text: '隱藏提問', visibility: 'author_only' }], error: null });
  mocks.authorizeTeacherAi.mockResolvedValue({ client: { from: table, rpc }, user: { id: owner } });
  mocks.claimTeacherAi.mockReset().mockResolvedValue(null);
  mocks.generateLectureNotes.mockReset().mockResolvedValue(notes);
});

describe('POST /api/live-recordings/[id]/notes', () => {
  it('generates notes from the ordered transcript, slide timeline, slide text and public questions, then saves them', async () => {
    // Page 7 was never on screen during the recording.
    const response = await POST(request({ slides: [{ page: 1, text: 'IF 語法' }, { page: 2, text: ' ' }, { page: 7, text: '樞紐分析表' }] }), { params: params() });
    expect(response.status).toBe(200);
    expect(mocks.claimTeacherAi).toHaveBeenCalledWith(expect.anything(), 'lesson_notes');
    expect(mocks.generateLectureNotes).toHaveBeenCalledWith({
      language: 'zh-TW',
      title: '第三課',
      transcript: '[0:00] 今天先介紹 IF 函數的語法，第一個參數是條件，第二個是成立時的結果\n\n[5:00] 接著示範巢狀 IF，再用 VLOOKUP 把成績對照到等第，記得第四個參數填 FALSE',
      slideTimeline: [{ page: 1, from: '0:00', to: '2:00' }, { page: 2, from: '2:00', to: '6:40' }],
      slides: [{ page: 1, text: 'IF 語法' }],
      studentQuestions: ['公開提問'],
    });
    // Pages no section covers are listed for students: 2 was shown but not
    // talked about, 7 never shown.
    // The deck is kept with the notes: the session's deck may be replaced later.
    const saved = { ...notes, uncoveredSlides: [{ page: 2, title: '' }, { page: 7, title: '樞紐分析表' }], deckUrl: 'https://cdn.test/deck-v1.pdf' };
    expect(updates[0]).toMatchObject({ notes: saved });
    // Not a heartbeat: an abandoned recording must not look live again.
    expect(updates[0]).not.toHaveProperty('updated_at');
    expect((await response.json()).notes).toEqual(saved);
  });
  it('keeps a section from claiming a slide that was never on screen', async () => {
    mocks.generateLectureNotes.mockResolvedValue({ ...notes, sections: [{ ...notes.sections[0], slidePages: [1, 7] }] });
    const response = await POST(request({ slides: [{ page: 1, text: 'IF 語法' }, { page: 7, text: '樞紐分析表' }] }), { params: params() });
    const body = await response.json();
    expect(body.notes.sections[0].slidePages).toEqual([1]);
    expect(body.notes.uncoveredSlides).toEqual([{ page: 7, title: '樞紐分析表' }]);
  });
  it('refuses without spending points when nothing has been transcribed', async () => {
    recording.live_recording_segments = [{ idx: 0, start_seconds: 0, duration_seconds: 300, status: 'failed', transcript: null, error: 'x' }];
    expect((await POST(request(), { params: params() })).status).toBe(409);
    expect(mocks.claimTeacherAi).not.toHaveBeenCalled();
  });
  it('refuses without spending points when barely anything was said', async () => {
    recording.live_recording_segments = [{ idx: 0, start_seconds: 0, duration_seconds: 4, status: 'transcribed', transcript: '[0:00] 大家好', error: null }];
    const response = await POST(request(), { params: params() });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('TRANSCRIPT_TOO_SHORT');
    expect(mocks.claimTeacherAi).not.toHaveBeenCalled();
    expect(mocks.generateLectureNotes).not.toHaveBeenCalled();
  });
  it("404s for a recording that isn't the caller's", async () => {
    recording = null;
    expect((await POST(request(), { params: params() })).status).toBe(404);
  });
  it('reports an AI failure without saving anything', async () => {
    mocks.generateLectureNotes.mockRejectedValue(new Error('bad json'));
    expect((await POST(request(), { params: params() })).status).toBe(502);
    expect(updates).toEqual([]);
  });
});

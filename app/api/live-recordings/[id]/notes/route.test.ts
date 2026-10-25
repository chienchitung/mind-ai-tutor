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
    slide_marks: [{ t: 0, page: 1 }, { t: 120, page: 2 }],
    live_recording_segments: [
      { idx: 1, start_seconds: 300, duration_seconds: 100, status: 'transcribed', transcript: '第二段', error: null },
      { idx: 0, start_seconds: 0, duration_seconds: 300, status: 'transcribed', transcript: '第一段', error: null },
    ],
  };
  rpc = vi.fn().mockResolvedValue({ data: [{ text: '公開提問', visibility: 'public' }, { text: '隱藏提問', visibility: 'author_only' }], error: null });
  mocks.authorizeTeacherAi.mockResolvedValue({ client: { from: table, rpc }, user: { id: owner } });
  mocks.claimTeacherAi.mockReset().mockResolvedValue(null);
  mocks.generateLectureNotes.mockReset().mockResolvedValue(notes);
});

describe('POST /api/live-recordings/[id]/notes', () => {
  it('generates notes from the ordered transcript, slide timeline, slide text and public questions, then saves them', async () => {
    const response = await POST(request({ slides: [{ page: 1, text: 'IF 語法' }, { page: 2, text: ' ' }] }), { params: params() });
    expect(response.status).toBe(200);
    expect(mocks.claimTeacherAi).toHaveBeenCalledWith(expect.anything(), 'lesson_notes');
    expect(mocks.generateLectureNotes).toHaveBeenCalledWith({
      language: 'zh-TW',
      title: '第三課',
      transcript: '[0:00] 第一段\n\n[5:00] 第二段',
      slideTimeline: [{ page: 1, from: '0:00', to: '2:00' }, { page: 2, from: '2:00', to: '6:40' }],
      slides: [{ page: 1, text: 'IF 語法' }],
      studentQuestions: ['公開提問'],
    });
    expect(updates[0]).toMatchObject({ notes });
    // Not a heartbeat: an abandoned recording must not look live again.
    expect(updates[0]).not.toHaveProperty('updated_at');
    expect((await response.json()).notes).toEqual(notes);
  });
  it('refuses without spending points when nothing has been transcribed', async () => {
    recording.live_recording_segments = [{ idx: 0, start_seconds: 0, duration_seconds: 300, status: 'failed', transcript: null, error: 'x' }];
    expect((await POST(request(), { params: params() })).status).toBe(409);
    expect(mocks.claimTeacherAi).not.toHaveBeenCalled();
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeTeacherAi: vi.fn(),
  claimTeacherAi: vi.fn(),
  transcribeLectureAudio: vi.fn(),
}));
vi.mock('../../../gemini/security', () => ({
  authorizeTeacherAi: mocks.authorizeTeacherAi,
  claimTeacherAi: mocks.claimTeacherAi,
  aiFailure: () => new Response(JSON.stringify({ error: 'AI_FAILED' }), { status: 502 }),
}));
vi.mock('@/lib/gemini', () => ({ transcribeLectureAudio: mocks.transcribeLectureAudio }));

import { POST } from './route';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '11111111-1111-4111-8111-111111111111';
let rows: Record<string, any>;
let bucket: { download: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
let upserts: any[];

function table(name: string) {
  const filters: Record<string, unknown> = {};
  const chain: any = {
    select: () => chain,
    eq: (column: string, value: unknown) => { filters[column] = value; return chain; },
    maybeSingle: async () => {
      if (name === 'live_recordings') return { data: rows.recording, error: null };
      return { data: rows.segments[filters.idx as number] ?? null, error: null };
    },
    upsert: async (row: any) => { upserts.push(row); return { error: null }; },
  };
  return chain;
}

const request = (body: unknown) => new Request(`https://test.local/api/live-recordings/${id}/segments`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://test.local' }, body: JSON.stringify(body),
});
const params = () => Promise.resolve({ id });

beforeEach(() => {
  rows = { recording: { id }, segments: {} };
  upserts = [];
  bucket = {
    download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };
  mocks.authorizeTeacherAi.mockResolvedValue({ client: { from: table, storage: { from: () => bucket } }, user: { id: owner } });
  mocks.claimTeacherAi.mockReset().mockResolvedValue(null);
  mocks.transcribeLectureAudio.mockReset().mockResolvedValue([{ start: '0:00', text: '老師說的話' }, { start: '2:13', text: '那我們來看巢狀 IF' }]);
});

describe('POST /api/live-recordings/[id]/segments', () => {
  it("transcribes the uploaded segment from the owner's folder, saves the text and deletes the audio", async () => {
    rows.segments[2] = { idx: 2, status: 'transcribed', start_seconds: 600, transcript: '[10:00] 前一段\n\n[13:20] 的結尾內容' };
    const response = await POST(request({ idx: 3, startSeconds: 900, durationSeconds: 300 }), { params: params() });
    expect(response.status).toBe(200);
    const timed = '[15:00] 老師說的話\n\n[17:13] 那我們來看巢狀 IF';
    expect(await response.json()).toEqual({ idx: 3, status: 'transcribed', transcript: timed });
    expect(bucket.download).toHaveBeenCalledWith(`${owner}/${id}/003.wav`);
    expect(mocks.claimTeacherAi).toHaveBeenCalledWith(expect.anything(), 'transcription');
    // The previous segment's text is passed as context without its timestamps.
    expect(mocks.transcribeLectureAudio).toHaveBeenCalledWith('AQID', { language: 'zh-TW', previousTail: '前一段 的結尾內容' });
    expect(upserts.at(-1)).toMatchObject({ recording_id: id, idx: 3, user_id: owner, start_seconds: 900, status: 'transcribed', transcript: timed });
    expect(bucket.remove).toHaveBeenCalledWith([`${owner}/${id}/003.wav`]);
  });
  it('returns an already-transcribed segment without spending points again', async () => {
    rows.segments[0] = { idx: 0, status: 'transcribed', transcript: '已完成' };
    const response = await POST(request({ idx: 0, startSeconds: 0, durationSeconds: 300 }), { params: params() });
    expect(await response.json()).toEqual({ idx: 0, status: 'transcribed', transcript: '已完成' });
    expect(mocks.claimTeacherAi).not.toHaveBeenCalled();
    expect(bucket.download).not.toHaveBeenCalled();
  });
  it('refuses before charging when the audio was never uploaded', async () => {
    bucket.download.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const response = await POST(request({ idx: 0, startSeconds: 0, durationSeconds: 300 }), { params: params() });
    expect(response.status).toBe(409);
    expect(mocks.claimTeacherAi).not.toHaveBeenCalled();
  });
  it('marks the segment failed and keeps its audio for a retry when transcription fails', async () => {
    mocks.transcribeLectureAudio.mockRejectedValue(new Error('gemini down'));
    const response = await POST(request({ idx: 0, startSeconds: 0, durationSeconds: 300 }), { params: params() });
    expect(response.status).toBe(502);
    expect(upserts.at(-1)).toMatchObject({ idx: 0, status: 'failed' });
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it("404s for another teacher's recording and rejects out-of-range input", async () => {
    rows.recording = null;
    expect((await POST(request({ idx: 0, startSeconds: 0, durationSeconds: 300 }), { params: params() })).status).toBe(404);
    expect((await POST(request({ idx: 999, startSeconds: 0, durationSeconds: 300 }), { params: params() })).status).toBe(400);
  });
  it('stops at the quota check', async () => {
    mocks.claimTeacherAi.mockResolvedValue(new Response(null, { status: 402 }));
    expect((await POST(request({ idx: 0, startSeconds: 0, durationSeconds: 300 }), { params: params() })).status).toBe(402);
    expect(mocks.transcribeLectureAudio).not.toHaveBeenCalled();
  });
});

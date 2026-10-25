import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient }));
import { GET } from './route';

const request = (code = '482910') => new Request(`https://test.local/api/live/${code}`);
const params = (code = '482910') => Promise.resolve({ code });
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  rpc = vi.fn();
  getServerClient.mockResolvedValue({ rpc });
});

const row = {
  session_id: 's1', title: 'Excel 樞紐分析入門', status: 'open',
  active_poll_id: 'p1', poll_question: 'SUMIF?', poll_options: ['A', 'B'],
  vote_counts: [3, 1], vote_total: 4,
  pulse_counts: [0, 1, 2, 0, 0], pulse_total: 3, pulse_average: '2.33',
  deck_url: 'https://example.test/deck.pdf', deck_page: 2,
};

describe('GET /api/live/[code]', () => {
  it('rejects a malformed code without calling the database', async () => {
    expect((await GET(request(), { params: params('abc') })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns the mapped public state for a known code', async () => {
    rpc.mockImplementation(async (fn: string) => (fn === 'get_live_session_by_code' ? { data: [row], error: null } : { data: false, error: null }));
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sessionId: 's1', title: 'Excel 樞紐分析入門', status: 'open',
      poll: { pollId: 'p1', question: 'SUMIF?', options: ['A', 'B'], voteCounts: [3, 1], voteTotal: 4 },
      pulse: { pulseCounts: [0, 1, 2, 0, 0], pulseTotal: 3, pulseAverage: 2.33 },
      deckUrl: 'https://example.test/deck.pdf', deckPage: 2,
      recording: false,
    });
    expect(rpc).toHaveBeenCalledWith('get_live_session_by_code', { p_code: '482910' });
  });
  it('tells students the teacher is recording, and treats a missing notice function as not recording', async () => {
    rpc.mockImplementation(async (fn: string) => (fn === 'get_live_session_by_code' ? { data: [row], error: null } : { data: true, error: null }));
    expect((await (await GET(request(), { params: params() })).json()).recording).toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_live_session_recording', { p_code: '482910' });
    rpc.mockImplementation(async (fn: string) => (fn === 'get_live_session_by_code'
      ? { data: [row], error: null }
      : { data: null, error: { code: 'PGRST202', message: 'function not found' } }));
    const response = await GET(request(), { params: params() });
    expect(response.status).toBe(200);
    expect((await response.json()).recording).toBe(false);
  });
  it('returns 404 for an unknown code', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await GET(request(), { params: params() })).status).toBe(404);
  });
  it('does not leak database errors as a 200', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect((await GET(request(), { params: params() })).status).toBe(500);
  });
});

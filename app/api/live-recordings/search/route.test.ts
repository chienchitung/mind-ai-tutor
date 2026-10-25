import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient: mocks.getServerClient }));

import { GET } from './route';

const owner = '00000000-0000-4000-8000-000000000001';
let segments: any[];
let notes: any[];
let calls: Record<string, unknown[]>;

function table(name: string) {
  const record = (key: string, value: unknown) => { (calls[`${name}.${key}`] ??= []).push(value); };
  const chain: any = {
    select: () => chain,
    eq: (column: string, value: unknown) => { record(`eq.${column}`, value); return chain; },
    ilike: (column: string, value: unknown) => { record(`ilike.${column}`, value); return chain; },
    not: () => chain,
    order: () => chain,
    limit: async () => ({ data: name === 'live_recording_segments' ? segments : notes, error: null }),
  };
  return chain;
}

beforeEach(() => {
  calls = {};
  segments = [];
  notes = [];
  mocks.getServerClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    from: table,
  });
});

const search = (q: string) => GET(new Request(`https://test.local/api/live-recordings/search?q=${encodeURIComponent(q)}`));

it("finds transcript and notes hits in the owner's recordings, earliest transcript paragraph first", async () => {
  segments = [
    { recording_id: 'a', idx: 0, transcript: '[0:00] 開場\n\n[1:30] 先講 VLOOKUP 的語法' },
    { recording_id: 'a', idx: 1, transcript: '[5:10] VLOOKUP 第二次出現' },
  ];
  notes = [
    { id: 'a', notes: { summary: 'VLOOKUP 重點' } },
    { id: 'b', notes: { title: '查表', sections: [{ heading: '用 vlookup 合併資料', points: [] }] } },
  ];
  const response = await search('VLOOKUP');
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.a).toMatchObject({ where: 'transcript', at: '1:30' });
  expect(body.b).toMatchObject({ where: 'notes', at: null });
  expect(body.b.snippet).toContain('vlookup');
  expect(calls['live_recording_segments.eq.user_id']).toEqual([owner]);
  expect(calls['live_recordings.eq.user_id']).toEqual([owner]);
});

it('matches LIKE wildcards literally', async () => {
  await search('50%_off');
  expect(calls['live_recording_segments.ilike.transcript']).toEqual(['%50\\%\\_off%']);
});

it('rejects an empty or overlong query', async () => {
  expect((await search('  ')).status).toBe(400);
  expect((await search('x'.repeat(101))).status).toBe(400);
});

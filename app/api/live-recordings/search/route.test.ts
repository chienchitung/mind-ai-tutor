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
  const state: { columns: string; pattern?: string; ins: Record<string, unknown[]> } = { columns: '', ins: {} };
  // Segments: rows whose transcript matches the ILIKE pattern, like Postgres.
  const matching = () => segments.filter((row) => {
    if (!state.pattern) return true;
    const needle = state.pattern.slice(1, -1).replace(/\\(.)/g, '$1').toLocaleLowerCase();
    return String(row.transcript ?? '').toLocaleLowerCase().includes(needle);
  });
  const project = (rows: any[]) => rows.map((row) => (state.columns.includes('transcript') ? row : { recording_id: row.recording_id, idx: row.idx }));
  const chain: any = {
    select: (columns: string) => { state.columns = columns; return chain; },
    eq: (column: string, value: unknown) => { record(`eq.${column}`, value); return chain; },
    ilike: (column: string, value: string) => { record(`ilike.${column}`, value); state.pattern = value; return chain; },
    in: (column: string, values: unknown[]) => { state.ins[column] = values; return chain; },
    not: () => chain,
    order: () => chain,
    limit: async () => ({ data: name === 'live_recording_segments' ? segments : notes, error: null }),
    range: async (from: number, to: number) => {
      record('range', [from, to]);
      const rows = matching().sort((a, b) => (a.recording_id === b.recording_id ? a.idx - b.idx : a.recording_id < b.recording_id ? -1 : 1));
      return { data: project(rows.slice(from, to + 1)), error: null };
    },
    then: (resolve: (value: unknown) => void) => resolve({
      data: project(segments.filter((row) => Object.entries(state.ins).every(([column, values]) => values.includes(row[column])))),
      error: null,
    }),
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
  // Every query is scoped to the owner.
  expect(calls['live_recording_segments.eq.user_id'].every((id) => id === owner)).toBe(true);
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

it('lists every recording that mentions the term, however often another one does', async () => {
  segments = [
    ...Array.from({ length: 1200 }, (_, idx) => ({ recording_id: 'a-busy', idx, transcript: `[${idx}:00] IF 又出現了` })),
    { recording_id: 'b-once', idx: 0, transcript: '[0:00] 開場' },
    { recording_id: 'b-once', idx: 9, transcript: '[45:00] 最後提到 IF' },
  ];
  const body = await (await search('IF')).json();
  expect(Object.keys(body).sort()).toEqual(['a-busy', 'b-once']);
  expect(body['a-busy'].at).toBe('0:00');
  expect(body['b-once'].at).toBe('45:00');
});

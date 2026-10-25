import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient: mocks.getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate: mocks.broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { void callback(); },
}));

import { DELETE, PATCH } from './route';

const owner = '00000000-0000-4000-8000-000000000001';
const id = '11111111-1111-4111-8111-111111111111';
const sessionId = '60000000-0000-4000-8000-000000000001';
let row: any;
let updates: any[];

beforeEach(() => {
  updates = [];
  row = { id, session_id: sessionId, status: 'recording' };
  mocks.broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  const chain: any = {
    update: (value: any) => { updates.push(value); return chain; },
    delete: () => chain,
    eq: () => chain,
    select: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  mocks.getServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: owner } }, error: null }) },
    from: () => chain,
    storage: { from: () => ({ list: vi.fn().mockResolvedValue({ data: [], error: null }), remove: vi.fn() }) },
  });
});

const request = (method: string, body?: unknown) => new Request(`https://test.local/api/live-recordings/${id}`, {
  method, headers: { 'Content-Type': 'application/json', origin: 'https://test.local' }, body: body ? JSON.stringify(body) : undefined,
});
const params = () => Promise.resolve({ id });

describe('ending the students\' recording notice', () => {
  it('clears it when the recording is stopped, but not on a progress save', async () => {
    expect((await PATCH(request('PATCH', { durationSeconds: 120 }), { params: params() })).status).toBe(200);
    expect(mocks.broadcastLiveUpdate).not.toHaveBeenCalled();
    expect((await PATCH(request('PATCH', { status: 'stopped', durationSeconds: 300 }), { params: params() })).status).toBe(200);
    expect(updates.at(-1)).toMatchObject({ status: 'stopped', duration_seconds: 300 });
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith(sessionId, 'recording:state', { active: false });
  });
  it('clears it when a recording still marked as recording is deleted', async () => {
    expect((await DELETE(request('DELETE'), { params: params() })).status).toBe(204);
    expect(mocks.broadcastLiveUpdate).toHaveBeenCalledWith(sessionId, 'recording:state', { active: false });
    mocks.broadcastLiveUpdate.mockClear();
    row = { id, session_id: sessionId, status: 'stopped' };
    await DELETE(request('DELETE'), { params: params() });
    expect(mocks.broadcastLiveUpdate).not.toHaveBeenCalled();
  });
});

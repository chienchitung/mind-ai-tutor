import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerClient, broadcastLiveUpdate } = vi.hoisted(() => ({ getServerClient: vi.fn(), broadcastLiveUpdate: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient }));
vi.mock('@/lib/live-broadcast', () => ({ broadcastLiveUpdate }));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: (task: () => unknown) => { void task(); } }));

import { DELETE } from './route';

const owner = '00000000-0000-4000-8000-000000000001';
const path = `${owner}/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`;
const url = `https://storage.example/live-decks/${path}`;
let chain: Record<string, ReturnType<typeof vi.fn>>;
let bucket: Record<string, ReturnType<typeof vi.fn>>;

const request = (body: unknown, origin = 'https://test.local') => new Request('https://test.local/api/live-decks', {
  method: 'DELETE', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body),
});

beforeEach(() => {
  broadcastLiveUpdate.mockReset().mockResolvedValue(undefined);
  chain = { update: vi.fn(), eq: vi.fn(), select: vi.fn().mockResolvedValue({ data: [{ id: 's1' }], error: null }) };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  bucket = {
    getPublicUrl: vi.fn((p: string) => ({ data: { publicUrl: `https://storage.example/live-decks/${p}` } })),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };
  getServerClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: owner } }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
    storage: { from: vi.fn().mockReturnValue(bucket) },
  });
});

describe('DELETE /api/live-decks', () => {
  it('detaches the deck from sessions using it, then removes the file', async () => {
    const response = await DELETE(request({ path }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ detachedSessionIds: ['s1'] });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ deck_url: null, deck_page: 1 }));
    expect(chain.eq).toHaveBeenCalledWith('user_id', owner);
    expect(chain.eq).toHaveBeenCalledWith('deck_url', url);
    expect(bucket.remove).toHaveBeenCalledWith([path]);
    expect(broadcastLiveUpdate).toHaveBeenCalledWith('s1', 'deck:sync', { page: 1, deckUrl: null });
  });
  it("refuses another teacher's folder, path traversal and cross-origin requests", async () => {
    expect((await DELETE(request({ path: 'someone-else/x.pdf' }))).status).toBe(403);
    expect((await DELETE(request({ path: `${owner}/../x.pdf` }))).status).toBe(403);
    expect((await DELETE(request({ path }, 'https://evil.example'))).status).toBe(403);
    expect(bucket.remove).not.toHaveBeenCalled();
  });
  it('rejects invalid input and signed-out callers', async () => {
    expect((await DELETE(request({}))).status).toBe(400);
    const client = await getServerClient();
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await DELETE(request({ path }))).status).toBe(401);
  });
  it('reports a storage failure without claiming success', async () => {
    bucket.remove.mockResolvedValue({ error: { message: 'denied' } });
    expect((await DELETE(request({ path }))).status).toBe(500);
  });
});

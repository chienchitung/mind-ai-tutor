import { beforeEach, expect, it, vi } from 'vitest';

const { getServerClient } = vi.hoisted(() => ({ getServerClient: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClient }));
import { GET } from './route';

const request = () => new Request('https://test.local/api/live/482910/presentation');
const params = () => Promise.resolve({ code: '482910' });
let snapshot: Record<string, unknown>;
let shares: { data: unknown; error: unknown };
const rpc = vi.fn(async (fn: string) => (fn === 'get_live_presentation' ? { data: { ...snapshot }, error: null } : shares));

beforeEach(() => {
  rpc.mockClear();
  shares = { data: false, error: null };
  getServerClient.mockResolvedValue({ rpc });
});

it('shows the slides during class without asking about sharing', async () => {
  snapshot = { status: 'open', mode: 'deck', deckUrl: 'https://example.test/deck.pdf' };
  expect((await (await GET(request(), { params: params() })).json()).deckUrl).toBe('https://example.test/deck.pdf');
  expect(rpc).not.toHaveBeenCalledWith('live_session_shares_deck', expect.anything());
});

it('withholds the slides of an ended class unless they were shared', async () => {
  snapshot = { status: 'closed', mode: 'deck', deckUrl: 'https://example.test/deck.pdf' };
  expect((await (await GET(request(), { params: params() })).json()).deckUrl).toBeNull();
  shares = { data: true, error: null };
  expect((await (await GET(request(), { params: params() })).json()).deckUrl).toBe('https://example.test/deck.pdf');
});

// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveTimer } from './useLiveTimer';

const paused = { durationSeconds: 300, remainingSeconds: 300, endsAt: null };
const running = () => ({ durationSeconds: 300, remainingSeconds: 300, endsAt: new Date(Date.now() + 300_000).toISOString() });
const reply = (body: unknown) => new Response(JSON.stringify(body));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => reply({ timer: paused, serverNow: Date.now() }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('ignores a read that started before a newer broadcast', async () => {
  let release!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
  const { result } = renderHook(() => useLiveTimer('/api/live/482910/timer'));
  act(() => result.current.apply({ timer: running(), serverNow: Date.now() }));
  expect(result.current.running).toBe(true);
  // The read reflects the server a moment before the broadcast's write.
  await act(async () => { release(reply({ timer: paused, serverNow: Date.now() - 500 })); });
  expect(result.current.running).toBe(true);
});

it('drops a delayed broadcast older than a later pause', () => {
  const { result } = renderHook(() => useLiveTimer('/api/live/482910/timer'));
  const t = Date.now();
  act(() => result.current.apply({ timer: paused, serverNow: t + 2_000 }));
  act(() => result.current.apply({ timer: running(), serverNow: t + 1_000 }));
  expect(result.current.running).toBe(false);
  act(() => result.current.apply({ timer: null, serverNow: t + 3_000 }));
  expect(result.current.timer).toBeNull();
});

it('repairs a missed broadcast by re-reading every so often', async () => {
  const { result } = renderHook(() => useLiveTimer('/api/live/482910/timer'));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(result.current.timer).toEqual(paused);
  fetchMock.mockImplementation(async () => reply({ timer: null, serverNow: Date.now() }));
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(result.current.timer).toBeNull();
});

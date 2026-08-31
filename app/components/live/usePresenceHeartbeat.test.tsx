// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useOnlinePresenceCount } from './usePresenceHeartbeat';

function Harness({ onReady }: { onReady: (api: { count: number; registerPing: (id: string) => void }) => void }) {
  const { onlineCount, registerPing } = useOnlinePresenceCount();
  onReady({ count: onlineCount, registerPing });
  return <span>{onlineCount}</span>;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useOnlinePresenceCount', () => {
  it('counts distinct participants immediately on ping', () => {
    let api!: { count: number; registerPing: (id: string) => void };
    const { rerender } = render(<Harness onReady={(a) => { api = a; }} />);
    act(() => api.registerPing('p1'));
    rerender(<Harness onReady={(a) => { api = a; }} />);
    expect(api.count).toBe(1);
    act(() => { api.registerPing('p2'); api.registerPing('p1'); });
    rerender(<Harness onReady={(a) => { api = a; }} />);
    expect(api.count).toBe(2);
  });
  it('drops a participant after they stop pinging (stale prune)', () => {
    let api!: { count: number; registerPing: (id: string) => void };
    const { rerender } = render(<Harness onReady={(a) => { api = a; }} />);
    act(() => api.registerPing('p1'));
    rerender(<Harness onReady={(a) => { api = a; }} />);
    expect(api.count).toBe(1);
    act(() => { vi.advanceTimersByTime(35000); });
    rerender(<Harness onReady={(a) => { api = a; }} />);
    expect(api.count).toBe(0);
  });
  it('keeps a participant alive as long as pings keep arriving before the stale cutoff', () => {
    let api!: { count: number; registerPing: (id: string) => void };
    const { rerender } = render(<Harness onReady={(a) => { api = a; }} />);
    act(() => api.registerPing('p1'));
    for (let i = 0; i < 4; i += 1) {
      act(() => { vi.advanceTimersByTime(10000); api.registerPing('p1'); });
    }
    rerender(<Harness onReady={(a) => { api = a; }} />);
    expect(api.count).toBe(1);
  });
});
